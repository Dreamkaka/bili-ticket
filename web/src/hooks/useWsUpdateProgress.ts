"use client";

import { useEffect, useState } from "react";

/** 后端 status_update 约每 3 秒广播一次 */
export const WS_UPDATE_INTERVAL_MS = 3000;

/**
 * 基于最近一次 WS/HTTP 更新时间，计算到下次预期更新的倒计时进度。
 * 0 → 刚更新；1 → 即将到点（或已超时仍等待）。
 */
export function useWsUpdateProgress(
  lastUpdate: number | null,
  connectionStatus: "connecting" | "connected" | "disconnected"
): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (connectionStatus !== "connected" || lastUpdate == null) {
      setProgress(0);
      return;
    }

    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - lastUpdate;
      setProgress(Math.min(1, Math.max(0, elapsed / WS_UPDATE_INTERVAL_MS)));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lastUpdate, connectionStatus]);

  return progress;
}
