import type { DiffEvent, NodeStatus, TargetsCache } from "./types.ts";

const TARGETS_KEY: Deno.KvKey = ["targets:v1"];
const RUN_COUNTER_KEY: Deno.KvKey = ["meta:run_counter"];

/** 装配后的运行期配置 */
export type ProbeConfig = {
  gatewayUrl: string;
  probeToken?: string;
  nodeName: string;
  /** 与 WS 主探针同级，但不参与分片 */
  role: "primary" | "monitor";
  transport: "http" | "ws";
  userAgent: string;
  sessdata?: string;
  coreIds: string[];
  shardIds: string[];
  targetsTtlSec: number;
  heartbeatEvery: number;
  maxConcurrency: number;
};

function authHeaders(cfg: ProbeConfig): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cfg.probeToken) {
    headers.Authorization = `Bearer ${cfg.probeToken}`;
  }
  return headers;
}

function baseUrl(cfg: ProbeConfig): string {
  return cfg.gatewayUrl.trim().replace(/\/+$/, "");
}

function seedTargetsFromConfig(cfg: ProbeConfig): TargetsCache | null {
  if (cfg.coreIds.length === 0 && cfg.shardIds.length === 0) return null;
  return {
    core_ids: cfg.coreIds,
    shard_ids: cfg.shardIds,
    all_ids: [...cfg.coreIds, ...cfg.shardIds],
    fetched_at: 0,
    stale: true,
  };
}

export async function loadTargets(
  kv: Deno.Kv,
  cfg: ProbeConfig,
): Promise<{ targets: TargetsCache | null; refreshed: boolean; error?: string }> {
  const cached = (await kv.get<TargetsCache>(TARGETS_KEY)).value;
  const now = Date.now();

  if (
    cached?.all_ids?.length &&
    now - cached.fetched_at < cfg.targetsTtlSec * 1000
  ) {
    return { targets: { ...cached, stale: false }, refreshed: false };
  }

  if (!baseUrl(cfg)) {
    const seed = cached || seedTargetsFromConfig(cfg);
    return {
      targets: seed ? { ...seed, stale: true } : null,
      refreshed: false,
      error: "GATEWAY_HTTP_URL is empty",
    };
  }

  try {
    const resp = await fetch(`${baseUrl(cfg)}/api/probe/targets`, {
      headers: authHeaders(cfg),
    });
    if (!resp.ok) {
      const text = await resp.text();
      const seed = cached || seedTargetsFromConfig(cfg);
      return {
        targets: seed ? { ...seed, stale: true } : null,
        refreshed: false,
        error: `targets HTTP ${resp.status}: ${text.slice(0, 200)}`,
      };
    }

    const body = (await resp.json()) as {
      core_ids?: string[];
      shard_ids?: string[];
      all_ids?: string[];
    };
    const core_ids = Array.isArray(body.core_ids)
      ? body.core_ids.map(String)
      : [];
    const shard_ids = Array.isArray(body.shard_ids)
      ? body.shard_ids.map(String)
      : [];
    const all_ids =
      Array.isArray(body.all_ids) && body.all_ids.length > 0
        ? body.all_ids.map(String)
        : [...core_ids, ...shard_ids];

    const next: TargetsCache = {
      core_ids,
      shard_ids,
      all_ids,
      fetched_at: now,
      stale: false,
    };
    await kv.set(TARGETS_KEY, next);
    return { targets: next, refreshed: true };
  } catch (err) {
    const seed = cached || seedTargetsFromConfig(cfg);
    return {
      targets: seed ? { ...seed, stale: true } : null,
      refreshed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function reportToGateway(
  cfg: ProbeConfig,
  status: NodeStatus,
  diffs: DiffEvent[],
): Promise<void> {
  if (!baseUrl(cfg)) {
    throw new Error("GATEWAY_HTTP_URL is empty");
  }

  const resp = await fetch(`${baseUrl(cfg)}/api/probe/report`, {
    method: "POST",
    headers: authHeaders(cfg),
    body: JSON.stringify({
      node_name: cfg.nodeName,
      role: cfg.role,
      transport: cfg.transport,
      status,
      diffs,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`report HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
}

export async function nextRunCounter(kv: Deno.Kv): Promise<number> {
  const raw = (await kv.get<string>(RUN_COUNTER_KEY)).value;
  const n = (Number(raw || 0) || 0) + 1;
  await kv.set(RUN_COUNTER_KEY, String(n));
  return n;
}

export function stateKey(projectId: string): Deno.KvKey {
  return ["state", projectId];
}
