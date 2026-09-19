export function isAvailableStatus(status: string): boolean {
  return status === "可售" || status.includes("有票") || status.includes("预售中");
}

export function isUnsoldStatus(status: string): boolean {
  return status.includes("未开售") || status.includes("待开售");
}

/** B 站 saleStart 多为秒级时间戳 */
export function saleStartMs(saleStart?: number | null): number | null {
  if (!saleStart || saleStart <= 0) return null;
  return saleStart < 1e12 ? saleStart * 1000 : saleStart;
}

export function isSoldOutStatus(status: string): boolean {
  return (
    status === "已售罄" ||
    status.includes("无票") ||
    status.includes("售罄") ||
    status.includes("不能买")
  );
}

export function formatClock(ts: number): string {
  return new Date(ts).toTimeString().split(" ")[0] ?? "--:--:--";
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.toTimeString().split(" ")[0]}`;
}

/** 明日方舟官网风格日期：2026 // 07 / 11 */
export function formatAkDate(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y} // ${m} / ${day}`;
}

export function formatAkDateTime(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const time = d.toTimeString().slice(0, 8);
  return `${y} // ${m} / ${day}  ${time}`;
}

export function padIndex(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

export function formatPrice(cents: number): string {
  return `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** Go 主探针秒级心跳 */
export const PRIMARY_ALIVE_MS = 15_000;
/** HTTP 主探针（Deno serverless）分钟级 Cron，放宽到 3 分钟 */
export const HTTP_PRIMARY_ALIVE_MS = 180_000;
/** 辅助探针约 1 分钟 Cron，放宽到 2 分钟 */
export const MONITOR_ALIVE_MS = 120_000;

export function isMonitorRole(role?: string | null): boolean {
  return role === "monitor";
}

/** HTTP 传输（Deno serverless / CF worker） */
export function isHttpTransport(transport?: string | null): boolean {
  return transport === "http";
}

/** 与 Go 同级、但以 HTTP 实现的 serverless 主探针（primary + http） */
export function isServerlessPrimary(
  role?: string | null,
  transport?: string | null,
): boolean {
  return !isMonitorRole(role) && isHttpTransport(transport);
}

export function nodeAliveMs(
  role?: string | null,
  transport?: string | null,
): number {
  if (isMonitorRole(role)) return MONITOR_ALIVE_MS;
  if (isHttpTransport(transport)) return HTTP_PRIMARY_ALIVE_MS;
  return PRIMARY_ALIVE_MS;
}

export function isNodeAlive(
  lastHeartbeat: number,
  now = Date.now(),
  role?: string | null,
  transport?: string | null,
): boolean {
  return now - lastHeartbeat < nodeAliveMs(role, transport);
}
