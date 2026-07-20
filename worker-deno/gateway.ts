import type { DiffEvent, NodeStatus, TargetsCache } from "./types.ts";

const TARGETS_KEY = "targets:v1";

function authHeaders(): HeadersInit {
  const token = Deno.env.get("PROBE_TOKEN");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function baseUrl(): string {
  const url = Deno.env.get("GATEWAY_HTTP_URL") || "";
  return url.trim().replace(/\/+$/, "");
}

function parseIdList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function seedTargetsFromEnv(): TargetsCache | null {
  const core_ids = parseIdList(Deno.env.get("CORE_IDS"));
  const shard_ids = parseIdList(Deno.env.get("SHARD_IDS"));
  if (core_ids.length === 0 && shard_ids.length === 0) return null;
  return {
    core_ids,
    shard_ids,
    all_ids: [...core_ids, ...shard_ids],
    fetched_at: 0,
    stale: true,
  };
}

export async function loadTargets(kv: Deno.Kv): Promise<{
  targets: TargetsCache | null;
  refreshed: boolean;
  error?: string;
}> {
  const ttlSec = Math.max(
    60,
    Number(Deno.env.get("TARGETS_TTL_SEC") || 3600) || 3600,
  );
  const now = Date.now();

  const cachedEntry = await kv.get<TargetsCache>([TARGETS_KEY]);
  const cached = cachedEntry.value;

  if (cached?.all_ids?.length && now - cached.fetched_at < ttlSec * 1000) {
    return { targets: { ...cached, stale: false }, refreshed: false };
  }

  const gatewayUrl = baseUrl();
  if (!gatewayUrl) {
    const seed = cached || seedTargetsFromEnv();
    return {
      targets: seed ? { ...seed, stale: true } : null,
      refreshed: false,
      error: "GATEWAY_HTTP_URL is empty",
    };
  }

  const url = `${gatewayUrl}/api/probe/targets`;
  try {
    const resp = await fetch(url, { headers: authHeaders() });
    if (!resp.ok) {
      const text = await resp.text();
      const seed = cached || seedTargetsFromEnv();
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
    const all_ids = Array.isArray(body.all_ids) && body.all_ids.length > 0
      ? body.all_ids.map(String)
      : [...core_ids, ...shard_ids];

    const next: TargetsCache = {
      core_ids,
      shard_ids,
      all_ids,
      fetched_at: now,
      stale: false,
    };
    await kv.set([TARGETS_KEY], next);
    return { targets: next, refreshed: true };
  } catch (err) {
    const seed = cached || seedTargetsFromEnv();
    return {
      targets: seed ? { ...seed, stale: true } : null,
      refreshed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function reportToGateway(
  nodeName: string,
  status: NodeStatus,
  diffs: DiffEvent[],
): Promise<void> {
  const gatewayUrl = baseUrl();
  if (!gatewayUrl) {
    throw new Error("GATEWAY_HTTP_URL is empty");
  }

  const url = `${gatewayUrl}/api/probe/report`;
  const resp = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      node_name: nodeName,
      role: "monitor",
      status,
      diffs,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`report HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
}

export function nextRunCounter(): number {
  // 使用内存变量计次数。Deno Deploy Isolate 每次生命周期中会保留内存。
  // 本地和生产重新部署、Isolate 被关停重置时计数器重归 1，重新走首次强制注册流程（完全符合预期，且不消耗任何 KV 写额度）。
  globalRunCounter += 1;
  return globalRunCounter;
}

let globalRunCounter = 0;

export function stateKey(projectId: string): string[] {
  return ["state", projectId];
}
