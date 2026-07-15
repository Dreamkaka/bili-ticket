export function isAvailableStatus(status: string): boolean {
  return status === "可售" || status.includes("有票") || status.includes("预售中");
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
/** Worker 辅助探针约 1 分钟 Cron，放宽到 2 分钟 */
export const MONITOR_ALIVE_MS = 120_000;

export function isMonitorRole(role?: string | null): boolean {
  return role === "monitor";
}

export function nodeAliveMs(role?: string | null): number {
  return isMonitorRole(role) ? MONITOR_ALIVE_MS : PRIMARY_ALIVE_MS;
}

export function isNodeAlive(
  lastHeartbeat: number,
  now = Date.now(),
  role?: string | null,
): boolean {
  return now - lastHeartbeat < nodeAliveMs(role);
}
