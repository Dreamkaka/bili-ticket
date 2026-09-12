import {
  fetchProjectStates,
  HTTPError,
  isRiskControlError,
} from "./bilibili.ts";
import { diffStates, recordToStates, statesToRecord } from "./diff.ts";
import {
  loadTargets,
  nextRunCounter,
  reportToGateway,
  stateKey,
  type ProbeConfig,
} from "./gateway.ts";
import type { DiffEvent, NodeStatus, TicketState } from "./types.ts";

const DEFAULT_UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 ";

// Deno KV：Deno Deploy 默认可用；本地写当前目录缓存
const kv = await Deno.openKv();

function env(name: string): string {
  return (Deno.env.get(name) || "").trim();
}

function parseIdList(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function loadConfig(): ProbeConfig {
  const role = env("ROLE") === "monitor" ? "monitor" : "primary";
  const transport = env("TRANSPORT") === "ws" ? "ws" : "http";
  return {
    gatewayUrl: env("GATEWAY_HTTP_URL"),
    probeToken: env("PROBE_TOKEN") || undefined,
    nodeName: env("NODE_NAME") || "deno-probe",
    role,
    transport,
    userAgent: env("PROBE_USER_AGENT") || DEFAULT_UA,
    sessdata: env("SESSDATA") || undefined,
    coreIds: parseIdList(env("CORE_IDS")),
    shardIds: parseIdList(env("SHARD_IDS")),
    targetsTtlSec: Math.max(60, Number(env("TARGETS_TTL_SEC") || 3600) || 3600),
    heartbeatEvery: Math.max(
      1,
      Number(env("HEARTBEAT_EVERY_N_RUNS") || 1) || 1,
    ),
    maxConcurrency: Math.max(1, Number(env("MAX_CONCURRENCY") || 3) || 3),
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]!);
    }
  }

  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

async function runMonitor(cfg: ProbeConfig): Promise<void> {
  if (!cfg.gatewayUrl) {
    console.error(
      "GATEWAY_HTTP_URL is empty. Set it via Deno Deploy env or --env-file",
    );
  } else {
    console.log(
      `monitor start: gateway=${cfg.gatewayUrl} node=${cfg.nodeName} role=${cfg.role}`,
    );
  }

  const run = await nextRunCounter(kv);
  const { targets, refreshed, error: targetsError } = await loadTargets(kv, cfg);

  if (!targets?.all_ids?.length) {
    const status: NodeStatus = {
      status: "error",
      http_code: 0,
      message: targetsError || "no monitor targets available",
    };
    try {
      await reportToGateway(cfg, status, []);
    } catch (err) {
      console.error("report failed (no targets):", err);
    }
    console.error("abort: no targets", targetsError);
    return;
  }

  const allDiffs: DiffEvent[] = [];
  let worst: NodeStatus = {
    status: "healthy",
    http_code: 200,
    message: refreshed
      ? "OK"
      : targets.stale
        ? `OK (targets_stale${targetsError ? `: ${targetsError}` : ""})`
        : "OK",
  };

  const projectIds = targets.all_ids;

  await mapPool(projectIds, cfg.maxConcurrency, async (projectId) => {
    try {
      const newStates = await fetchProjectStates(
        projectId,
        cfg.userAgent,
        cfg.sessdata,
      );
      const prevRaw = (await kv.get<Record<string, TicketState>>(
        stateKey(projectId),
      )).value;
      const isFirst = !prevRaw;
      const oldStates = recordToStates(prevRaw);

      if (!isFirst) {
        const diffs = diffStates(projectId, oldStates, newStates);
        allDiffs.push(...diffs);
      }

      await kv.set(stateKey(projectId), statesToRecord(newStates));
    } catch (err) {
      console.error(`project ${projectId} failed:`, err);
      if (isRiskControlError(err)) {
        if (worst.status !== "risk_control") {
          worst = {
            status: "risk_control",
            http_code: err instanceof HTTPError ? err.statusCode : 0,
            message:
              err instanceof Error ? err.message : "IP rate limited or blocked",
          };
        }
      } else if (worst.status === "healthy") {
        worst = {
          status: "error",
          http_code: err instanceof HTTPError ? err.statusCode : 0,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }
  });

  // 第 1 次必报（注册节点）；之后按 HEARTBEAT_EVERY_N_RUNS 或有 diff 时上报
  const shouldHeartbeat =
    run === 1 || run % cfg.heartbeatEvery === 0 || allDiffs.length > 0;
  if (!shouldHeartbeat) {
    console.log(
      `skip report: run=${run} diffs=0 heartbeatEvery=${cfg.heartbeatEvery}`,
    );
    return;
  }

  try {
    await reportToGateway(cfg, worst, allDiffs);
    console.log(
      `reported: node=${cfg.nodeName} diffs=${allDiffs.length} status=${worst.status} targets=${projectIds.length}`,
    );
  } catch (err) {
    console.error("report failed:", err);
  }
}

// 分钟级 Cron（Deno Deploy 托管执行）
Deno.cron("ticket-monitor", "* * * * *", async () => {
  try {
    await runMonitor(loadConfig());
  } catch (err) {
    console.error("cron run failed:", err);
  }
});

Deno.serve(async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const cfg = loadConfig();

  // 本地 / 手动触发监测（本地不自动跑 cron）
  if (url.pathname === "/run" || url.pathname === "/__run") {
    if (request.method !== "GET" && request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    try {
      await runMonitor(cfg);
      return Response.json({ ok: true, triggered: true });
    } catch (err) {
      console.error("manual run failed:", err);
      return Response.json(
        {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      );
    }
  }

  return Response.json({
    ok: true,
    node_name: cfg.nodeName,
    role: cfg.role,
    transport: cfg.transport,
    gateway_http_url: cfg.gatewayUrl || null,
    has_probe_token: Boolean(cfg.probeToken),
    has_sessdata: Boolean(cfg.sessdata),
    hint: "GET or POST /run to trigger one monitor cycle (local cron is not relied upon)",
  });
});
