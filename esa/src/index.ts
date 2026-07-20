import { fetchProjectStates, HTTPError, isRiskControlError } from "./bilibili";
import { diffStates, recordToStates, statesToRecord } from "./diff";
import { loadTargets, nextRunCounter, reportToGateway, stateKey } from "./gateway";
import { AdaptiveKV } from "./kv";
import type { DiffEvent, Env, NodeStatus, TicketState } from "./types";

const DEFAULT_UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 ";

async function runMonitor(env: Env): Promise<void> {
  const kv = new AdaptiveKV(env);
  const nodeName = env.NODE_NAME || "aliyun-esa-monitor";
  const userAgent = env.PROBE_USER_AGENT || DEFAULT_UA;
  const sessdata = (env.SESSDATA || "").trim();
  const heartbeatEvery = Math.max(1, Number(env.HEARTBEAT_EVERY_N_RUNS || 5) || 5);
  // 阿里云 ESA 单次执行限制最多 4 次 fetch 子请求，分批轮询大小限制默认为 2
  const maxProjectsPerRun = Math.max(1, Number(env.MAX_PROJECTS_PER_RUN || 2) || 2);
  const gatewayUrl = (env.GATEWAY_HTTP_URL || "").trim();

  if (!gatewayUrl) {
    console.error("GATEWAY_HTTP_URL is empty. Configure it in ESA function settings.");
  } else {
    console.log(`monitor start: gateway=${gatewayUrl} node=${nodeName}`);
  }

  const run = await nextRunCounter(env, kv);
  const { targets, refreshed, error: targetsError } = await loadTargets(env, kv);

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

  const allTargets = targets.all_ids;
  // 通过轮管逻辑切分本次查询的项目集合（确保不会触发 ESA 子请求限制）
  const startIndex = ((run - 1) * maxProjectsPerRun) % allTargets.length;
  const projectIds = allTargets.slice(startIndex, startIndex + maxProjectsPerRun);

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

  for (const projectId of projectIds) {
    try {
      const newStates = await fetchProjectStates(projectId, userAgent, sessdata);
      const prevRaw = await kv.getJson<Record<string, TicketState>>(stateKey(projectId));
      const isFirst = !prevRaw;
      const oldStates = recordToStates(prevRaw);

      if (!isFirst) {
        const diffs = diffStates(projectId, oldStates, newStates);
        allDiffs.push(...diffs);
      }

      await kv.put(stateKey(projectId), JSON.stringify(statesToRecord(newStates)));
    } catch (err) {
      console.error(`project ${projectId} failed:`, err);
      if (isRiskControlError(err)) {
        if (worst.status !== "risk_control") {
          worst = {
            status: "risk_control",
            http_code: err instanceof HTTPError ? err.statusCode : 0,
            message: err instanceof Error ? err.message : "IP rate limited or blocked",
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
  }

  // 校验上报触发条件
  const shouldHeartbeat = run === 1 || run % heartbeatEvery === 0 || allDiffs.length > 0;
  if (!shouldHeartbeat) {
    console.log(`skip report: run=${run} diffs=0 heartbeatEvery=${heartbeatEvery}`);
    return;
  }

  try {
    await reportToGateway(env, nodeName, worst, allDiffs);
    console.log(
      `reported: node=${nodeName} diffs=${allDiffs.length} status=${worst.status} targets=${projectIds.join(",")}`,
    );
  } catch (err) {
    console.error("report failed:", err);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const gateway = (env.GATEWAY_HTTP_URL || "").replace(/\/+$/, "");

    // 支持 /run、/__run 或 /__scheduled (Cron) 路由触发
    if (
      url.pathname === "/run" ||
      url.pathname === "/__run" ||
      (url.pathname === "/__scheduled" && request.method === "POST")
    ) {
      try {
        await runMonitor(env);
        return Response.json({ ok: true, triggered: true, provider: "aliyun-esa" });
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
      node_name: env.NODE_NAME || "aliyun-esa-monitor",
      role: "monitor",
      provider: "aliyun-esa",
      gateway_http_url: gateway || null,
      has_probe_token: Boolean(env.PROBE_TOKEN),
      has_sessdata: Boolean((env.SESSDATA || "").trim()),
      has_edge_kv: Boolean(env.PROBE_STATE),
      hint: "POST or GET /run to trigger one monitor cycle",
    });
  },
};
