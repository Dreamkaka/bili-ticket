import type { AdaptiveKV } from "./kv";
import type { DiffEvent, Env, NodeStatus, TargetsCache } from "./types";

const TARGETS_KEY = "targets:v1";
const RUN_COUNTER_KEY = "meta:run_counter";

function authHeaders(env: Env): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (env.PROBE_TOKEN) {
    headers.Authorization = `Bearer ${env.PROBE_TOKEN}`;
  }
  return headers;
}

function baseUrl(env: Env): string {
  const raw = env.GATEWAY_HTTP_URL || "";
  return String(raw).trim().replace(/\/+$/, "");
}

function parseIdList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function seedTargetsFromEnv(env: Env): TargetsCache | null {
  const core_ids = parseIdList(env.CORE_IDS);
  const shard_ids = parseIdList(env.SHARD_IDS);
  if (core_ids.length === 0 && shard_ids.length === 0) return null;
  return {
    core_ids,
    shard_ids,
    all_ids: [...core_ids, ...shard_ids],
    fetched_at: 0,
    stale: true,
  };
}

export async function loadTargets(
  env: Env,
  kv: AdaptiveKV,
): Promise<{
  targets: TargetsCache | null;
  refreshed: boolean;
  error?: string;
}> {
  const ttlSec = Math.max(60, Number(env.TARGETS_TTL_SEC || 3600) || 3600);
  const cached = await kv.getJson<TargetsCache>(TARGETS_KEY);
  const now = Date.now();

  if (cached?.all_ids?.length && now - cached.fetched_at < ttlSec * 1000) {
    return { targets: { ...cached, stale: false }, refreshed: false };
  }

  const url = `${baseUrl(env)}/api/probe/targets`;
  if (!baseUrl(env)) {
    const seed = cached || seedTargetsFromEnv(env);
    return {
      targets: seed ? { ...seed, stale: true } : null,
      refreshed: false,
      error: "GATEWAY_HTTP_URL is empty",
    };
  }

  try {
    const resp = await fetch(url, { headers: authHeaders(env) });
    if (!resp.ok) {
      const text = await resp.text();
      const seed = cached || seedTargetsFromEnv(env);
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
    await kv.put(TARGETS_KEY, JSON.stringify(next));
    return { targets: next, refreshed: true };
  } catch (err) {
    const seed = cached || seedTargetsFromEnv(env);
    return {
      targets: seed ? { ...seed, stale: true } : null,
      refreshed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function reportToGateway(
  env: Env,
  nodeName: string,
  status: NodeStatus,
  diffs: DiffEvent[],
): Promise<void> {
  const url = `${baseUrl(env)}/api/probe/report`;
  if (!baseUrl(env)) {
    throw new Error("GATEWAY_HTTP_URL is empty");
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: authHeaders(env),
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

export async function nextRunCounter(env: Env, kv: AdaptiveKV): Promise<number> {
  const raw = await kv.get(RUN_COUNTER_KEY);
  const n = (Number(raw || 0) || 0) + 1;
  await kv.put(RUN_COUNTER_KEY, String(n));
  return n;
}

export function stateKey(projectId: string): string {
  return `state:${projectId}`;
}
