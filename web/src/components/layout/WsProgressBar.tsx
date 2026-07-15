"use client";

import { memo, useRef } from "react";
import type { ConnectionStatus } from "@/lib/types";
import { useWsProgressBarDom } from "@/hooks/useWsUpdateProgress";

export const WsProgressBar = memo(function WsProgressBar({
  lastUpdate,
  connectionStatus,
}: {
  lastUpdate: number | null;
  connectionStatus: ConnectionStatus;
}) {
  const fillRef = useRef<HTMLDivElement>(null);
  const active = connectionStatus === "connected";

  useWsProgressBarDom(fillRef, lastUpdate, connectionStatus);

  return (
    <div
      className="pointer-events-none fixed right-0 bottom-0 left-0 z-[100]"
      aria-hidden
      title="WebSocket status_update 倒计时"
    >
      <div className="h-0.5 w-full bg-[var(--hairline)]">
        <div
          ref={fillRef}
          className={`h-full will-change-[width] ${
            active ? "bg-accent" : "bg-danger/70"
          }`}
          style={{ width: "0%" }}
        />
      </div>
    </div>
  );
});
