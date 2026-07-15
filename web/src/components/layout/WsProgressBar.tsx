"use client";

import type { ConnectionStatus } from "@/lib/types";

export function WsProgressBar({
  progress,
  connectionStatus,
}: {
  progress: number;
  connectionStatus: ConnectionStatus;
}) {
  const active = connectionStatus === "connected";
  const width = active ? Math.min(100, Math.max(0, progress * 100)) : 0;

  return (
    <div
      className="pointer-events-none fixed right-0 bottom-0 left-0 z-[100]"
      aria-hidden
      title="WebSocket status_update 倒计时"
    >
      <div className="h-0.5 w-full bg-[var(--hairline)]">
        <div
          className={`h-full will-change-[width] ${
            active ? "bg-accent" : "bg-danger/70"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
