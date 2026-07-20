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
} from "./gateway.ts";
import type { DiffEvent, NodeStatus, TicketState } from "./types.ts";

const DEFAULT_UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 ";

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

let kvInstance: Deno.Kv | null = null;
async function getKv(): Promise<Deno.Kv> {
  if (!kvInstance) {
    kvInstance = await Deno.openKv();
  }
  return kvInstance;
}

export async function runMonitor(): Promise<void> {
  const nodeName = Deno.env.get("NODE_NAME") || "deno-monitor";
  const userAgent = Deno.env.get("PROBE_USER_AGENT") || DEFAULT_UA;
  const sessdata = (Deno.env.get("SESSDATA") || "").trim();
  const concurrency = Math.max(
    1,
    Number(Deno.env.get("MAX_CONCURRENCY") || 3) || 3,
  );
  const heartbeatEvery = Math.max(
    1,
    Number(Deno.env.get("HEARTBEAT_EVERY_N_RUNS") || 5) || 5,
  );
  const gatewayUrl = (Deno.env.get("GATEWAY_HTTP_URL") || "").trim();

  if (!gatewayUrl) {
    console.error(
      "GATEWAY_HTTP_URL is empty. Set it in Deno Deploy environment variables or .env",
    );
  } else {
    console.log(`monitor start: gateway=${gatewayUrl} node=${nodeName}`);
  }

  const kv = await getKv();
  const run = await nextRunCounter(kv);
  const { targets, refreshed, error: targetsError } = await loadTargets(kv);

  if (!targets?.all_ids?.length) {
    const status: NodeStatus = {
      status: "error",
      http_code: 0,
      message: targetsError || "no monitor targets available",
    };
    try {
      await reportToGateway(nodeName, status, []);
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

  await mapPool(projectIds, concurrency, async (projectId) => {
    try {
      const newStates = await fetchProjectStates(
        projectId,
        userAgent,
        sessdata,
      );
      const prevEntry = await kv.get<Record<string, TicketState>>(
        stateKey(projectId),
      );
      const prevRaw = prevEntry.value;
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
            message: err instanceof Error
              ? err.message
              : "IP rate limited or blocked",
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

  const shouldHeartbeat = run === 1 || run % heartbeatEvery === 0 ||
    allDiffs.length > 0;
  if (!shouldHeartbeat) {
    console.log(
      `skip report: run=${run} diffs=0 heartbeatEvery=${heartbeatEvery}`,
    );
    return;
  }

  try {
    await reportToGateway(nodeName, worst, allDiffs);
    console.log(
      `reported: node=${nodeName} diffs=${allDiffs.length} status=${worst.status} targets=${projectIds.length}`,
    );
  } catch (err) {
    console.error("report failed:", err);
  }
}

// 注册每分钟执行一次的 Deno.cron (Deno Deploy 自动在后台关联发现)
Deno.cron("bili-ticket-monitor-cron", "* * * * *", async () => {
  await runMonitor();
});

// Deno 官方原生 HTTP 服务导出
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const gateway = (Deno.env.get("GATEWAY_HTTP_URL") || "").replace(/\/+$/, "");

  if (url.pathname === "/run" || url.pathname === "/__run") {
    if (req.method !== "GET" && req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    try {
      await runMonitor();
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
    node_name: Deno.env.get("NODE_NAME") || "deno-monitor",
    role: "monitor",
    gateway_http_url: gateway || null,
    has_probe_token: Boolean(Deno.env.get("PROBE_TOKEN")),
    has_sessdata: Boolean((Deno.env.get("SESSDATA") || "").trim()),
    hint: "GET /run to trigger one monitor cycle manually",
  });
});
