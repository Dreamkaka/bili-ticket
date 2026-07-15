const CONFIGURED_BASE = (process.env.NEXT_PUBLIC_BASE_URL || "").trim();
const CONFIGURED_WS = (process.env.NEXT_PUBLIC_WS_URL || "").trim();

/**
 * 浏览器侧优先走当前站点同源路径，由 Next rewrites 转发到 gateway，
 * 避免 localhost:4000 → 127.0.0.1:3000 的 CORS Failed to fetch。
 * 需要强制直连后端时设 NEXT_PUBLIC_FORCE_ABSOLUTE_API=1。
 */
function resolveBaseUrl(): string {
  if (!CONFIGURED_BASE) return "";

  if (typeof window === "undefined") {
    return CONFIGURED_BASE;
  }

  if (process.env.NEXT_PUBLIC_FORCE_ABSOLUTE_API === "1") {
    return CONFIGURED_BASE;
  }

  try {
    let normalized = CONFIGURED_BASE;
    if (!/^https?:\/\//i.test(normalized) && !normalized.startsWith("/")) {
      normalized = "http://" + normalized;
    }
    if (normalized.startsWith("/")) return "";

    const base = new URL(normalized);
    if (base.host !== window.location.host) {
      return "";
    }
    return CONFIGURED_BASE;
  } catch {
    return "";
  }
}

function normalizeBase(base: string): string {
  let normalized = base.trim();
  if (!/^https?:\/\//i.test(normalized) && !normalized.startsWith("/")) {
    normalized = "http://" + normalized;
  }
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

export const formatApiUrl = (path: string): string => {
  const base = resolveBaseUrl();
  const pathClean = path.startsWith("/") ? path : `/${path}`;
  if (!base) return pathClean;
  return `${normalizeBase(base)}${pathClean}`;
};

export const getWsUrl = (): string => {
  // WebSocket 不能通过 Vercel rewrite 长连接代理，必须从浏览器直连 Gateway。
  // 可用 NEXT_PUBLIC_WS_URL 显式指定完整地址；否则从 NEXT_PUBLIC_BASE_URL 推导。
  const configured = CONFIGURED_WS || CONFIGURED_BASE;
  if (configured) {
    let normalized = configured;
    if (!/^(https?|wss?):\/\//i.test(normalized)) {
      normalized = `https://${normalized}`;
    }

    normalized = normalized
      .replace(/^https:/i, "wss:")
      .replace(/^http:/i, "ws:")
      .replace(/\/$/, "");

    if (/\/ws\/frontend$/i.test(normalized)) return normalized;
    return `${normalized}/ws/frontend`;
  }

  const host =
    typeof window !== "undefined" ? window.location.host : "localhost:4000";
  const protocol =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "wss:"
      : "ws:";
  return `${protocol}//${host}/ws/frontend`;
};
