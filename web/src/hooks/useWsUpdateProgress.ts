"use client";

import { useEffect, useRef } from "react";
import type { ConnectionStatus } from "@/lib/types";

/** 后端 status_update 约每 3 秒广播一次 */
export const WS_UPDATE_INTERVAL_MS = 3000;

/**
 * 将 WS 更新倒计时进度直接写到 DOM，避免 60fps setState 拖垮整页。
 */
export function useWsProgressBarDom(
  fillRef: React.RefObject<HTMLElement | null>,
  lastUpdate: number | null,
  connectionStatus: ConnectionStatus
) {
  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;

    if (connectionStatus !== "connected" || lastUpdate == null) {
      el.style.width = "0%";
      return;
    }

    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - lastUpdate;
      const p = Math.min(1, Math.max(0, elapsed / WS_UPDATE_INTERVAL_MS));
      el.style.width = `${p * 100}%`;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fillRef, lastUpdate, connectionStatus]);
}
