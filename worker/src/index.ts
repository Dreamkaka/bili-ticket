import {
  fetchProjectStates,
  HTTPError,
  isRiskControlError,
} from "./bilibili";
import { diffStates, recordToStates, statesToRecord } from "./diff";
import {
  loadTargets,
  nextRunCounter,
  reportToGateway,
  stateKey,
} from "./gateway";
import type { DiffEvent, Env, NodeStatus, TicketState } from "./types";

const DEFAULT_UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 ";

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

async function runMonitor(env: Env): Promise<Response | void> {
  const nodeName = env.NODE_NAME || "cf-worker-monitor";
  const userAgent = env.PROBE_USER_AGENT || DEFAULT_UA;
  const concurrency = Math.max(1, Number(env.MAX_CONCURRENCY || 3) || 3);
  const heartbeatEvery = Math.max(
    1,
    Number(env.HEARTBEAT_EVERY_N_RUNS || 5) || 5,
  );
  const gatewayUrl = (env.GATEWAY_HTTP_URL || "").trim();
  if (!gatewayUrl) {
    console.error(
      "GATEWAY_HTTP_URL is empty. Put it in worker/.env.local and run via: npm run dev",
    );
  } else {
    console.log(`monitor start: gateway=${gatewayUrl} node=${nodeName}`);
  }

  const run = await nextRunCounter(env);
  const { targets, refreshed, error: targetsError } = await loadTargets(env);

  if (!targets?.all_ids?.length) {
    const status: NodeStatus = {
      status: "error",
      http_code: 0,
      message: targetsError || "no monitor targets available",
    };
    try {
      await reportToGateway(env, nodeName, status, []);
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
      const newStates = await fetchProjectStates(projectId, userAgent);
      const prevRaw = await env.PROBE_STATE.get<Record<string, TicketState>>(
        stateKey(projectId),
        "json",
      );
      const isFirst = !prevRaw;
      const oldStates = recordToStates(prevRaw);

      if (!isFirst) {
        const diffs = diffStates(projectId, oldStates, newStates);
        allDiffs.push(...diffs);
      }

      await env.PROBE_STATE.put(
        stateKey(projectId),
        JSON.stringify(statesToRecord(newStates)),
      );
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
    run === 1 || run % heartbeatEvery === 0 || allDiffs.length > 0;
  if (!shouldHeartbeat) {
    console.log(
      `skip report: run=${run} diffs=0 heartbeatEvery=${heartbeatEvery}`,
    );
    return;
  }

  try {
    await reportToGateway(env, nodeName, worst, allDiffs);
    console.log(
      `reported: node=${nodeName} diffs=${allDiffs.length} status=${worst.status} targets=${projectIds.length}`,
    );
  } catch (err) {
    console.error("report failed:", err);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const gateway = (env.GATEWAY_HTTP_URL || "").replace(/\/+$/, "");

    // 本地 / 手动触发监测（Miniflare 不会自动跑 cron）
    if (
      url.pathname === "/run" ||
      url.pathname === "/__run" ||
      (url.pathname === "/__scheduled" && request.method === "POST")
    ) {
      if (request.method !== "GET" && request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      try {
        await runMonitor(env);
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
      node_name: env.NODE_NAME || "cf-worker-monitor",
      role: "monitor",
      gateway_http_url: gateway || null,
      has_probe_token: Boolean(env.PROBE_TOKEN),
      hint: "POST or GET /run to trigger one monitor cycle (local cron is not auto)",
    });
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runMonitor(env));
  },
};
