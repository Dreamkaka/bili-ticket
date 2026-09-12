"use client";

import type { ConnectionStatus } from "@/lib/types";
import { formatClock } from "@/lib/status";
import { Badge } from "@/components/ui/Badge";

export function NavExtras({
  connectionStatus,
  systemHealthy,
  lastUpdate,
  unreadCount,
  onOpenCommand,
  onOpenNotifications,
}: {
  connectionStatus: ConnectionStatus;
  systemHealthy: boolean;
  lastUpdate: number | null;
  unreadCount: number;
  onOpenCommand?: () => void;
  onOpenNotifications?: () => void;
}) {
  const connLabel =
    connectionStatus === "connected"
      ? "LINKED"
      : connectionStatus === "connecting"
        ? "SYNC"
        : "LOST";

  return (
    <div className="flex items-center gap-1.5">
      {onOpenNotifications ? (
        <button
          type="button"
          onClick={onOpenNotifications}
          className="relative inline-flex size-7 items-center justify-center text-fd-muted-foreground transition-colors hover:text-fd-foreground"
          aria-label={
            unreadCount > 0 ? `打开通知，${unreadCount} 条未读` : "打开通知"
          }
          title="票务通知"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 9a6 6 0 1 1 12 0c0 3.5 1.5 5 2 6H4c.5-1 2-2.5 2-6Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M10 18a2 2 0 0 0 4 0"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          {unreadCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center bg-accent px-0.5 text-[8px] font-bold text-accent-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
      ) : null}
      {onOpenCommand ? (
        <button
          type="button"
          onClick={onOpenCommand}
          className="hidden h-7 items-center gap-1 border border-fd-border px-1.5 font-mono text-[10px] tracking-wider text-fd-muted-foreground transition-colors hover:text-fd-foreground sm:inline-flex"
          aria-label="打开命令面板"
          title="命令面板"
        >
          CMD
        </button>
      ) : null}
      <Badge
        tone={connectionStatus === "connected" ? "accent" : "danger"}
        className="hidden sm:inline-flex"
      >
        {connLabel}
      </Badge>
      <Badge
        tone={systemHealthy ? "accent" : "warning"}
        className="hidden lg:inline-flex"
      >
        {systemHealthy ? "NOMINAL" : "ALERT"}
      </Badge>
      <span className="hidden font-mono text-[10px] tracking-wider text-fd-muted-foreground xl:inline">
        {lastUpdate ? formatClock(lastUpdate) : "--:--:--"}
      </span>
    </div>
  );
}
