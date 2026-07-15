"use client";

import type { ConnectionStatus } from "@/lib/types";
import { useBootProgress, type BootPhase } from "@/hooks/useBootProgress";
import { BootMark } from "@/components/boot/BootMark";

export function BootSequence({
  onDone,
  onPhaseChange,
  ready,
  connectionStatus,
}: {
  onDone: () => void;
  onPhaseChange?: (phase: BootPhase) => void;
  ready: boolean;
  connectionStatus: ConnectionStatus;
}) {
  const { percent, progress, phase, wipe } = useBootProgress({
    ready,
    connectionStatus,
    onPhaseChange,
    onDone,
  });

  const statusLine =
    connectionStatus === "connected"
      ? "LINK ESTABLISHED"
      : connectionStatus === "disconnected"
        ? "RETRYING UPLINK"
        : "SYSTEM INITIALIZING";

  // wipe-out 时卸掉加载底，只留青色扫光，主界面在下层
  const showLoader =
    phase === "loading" || phase === "finishing" || phase === "wipe-in";

  if (phase === "done") return null;

  const wipeStyle =
    phase === "wipe-in"
      ? {
          width: `${Math.max(0.5, wipe * 100)}%`,
          transform: "translate3d(0,0,0)",
        }
      : phase === "wipe-out"
        ? {
            width: "100%",
            transform: `translate3d(${wipe * 100}%,0,0)`,
          }
        : { width: "0%", transform: "translate3d(0,0,0)" };

  return (
    <div
      className="boot-overlay fixed inset-0 z-[9990] overflow-hidden"
      aria-busy={phase !== "wipe-out"}
      aria-label="系统初始化"
      style={{ isolation: "isolate" }}
    >
      {showLoader && (
        <div className="absolute inset-0 bg-[var(--background)]">
          <div className="ak-dots absolute inset-0 opacity-30 dark:opacity-20" />

          <div className="absolute top-0 bottom-0 left-0 flex w-14 flex-col sm:w-20">
            <div className="relative flex-1 overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-[3px] bg-[var(--hairline)] sm:w-1" />
              <div
                className="absolute bottom-0 left-0 w-[3px] bg-accent shadow-[0_0_18px_color-mix(in_oklab,var(--accent)_50%,transparent)] sm:w-1"
                style={{ height: `${Math.max(2, progress * 100)}%` }}
              />
            </div>

            <div className="relative z-10 px-2 pt-3 pb-8 sm:px-3 sm:pb-10">
              <div className="font-mono text-[clamp(1.75rem,5vw,2.75rem)] leading-none font-semibold tracking-tight text-accent tabular-nums">
                {percent}
                <span className="text-[0.45em] opacity-80">%</span>
              </div>
              <p className="mt-2 max-w-[4.5rem] text-[9px] leading-relaxed tracking-[0.18em] text-[var(--ink-faint)] uppercase sm:max-w-none sm:text-[10px]">
                {statusLine}
              </p>
            </div>
          </div>

          {(phase === "loading" || phase === "finishing") && (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <BootMark />
              </div>

              <div className="absolute right-3 bottom-6 max-w-[11rem] text-right sm:right-8 sm:bottom-10 sm:max-w-[14rem]">
                <div className="mb-2 flex items-center justify-end gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_color-mix(in_oklab,var(--accent)_70%,transparent)]" />
                  <p className="text-[8px] tracking-[0.16em] text-[var(--ink-faint)] uppercase sm:text-[9px] sm:tracking-[0.2em]">
                    Mission Dependent Payload
                  </p>
                </div>
                <p className="hidden text-[9px] tracking-[0.28em] text-[var(--ink-faint)]/70 uppercase sm:block">
                  System Interfaces
                </p>
                <div className="mt-2 ml-auto h-px w-16 bg-gradient-to-l from-[var(--hairline)] to-transparent sm:w-24" />
                <p className="mt-2 text-[9px] leading-relaxed tracking-[0.12em] text-[var(--ink-soft)] sm:mt-3 sm:text-[10px] sm:tracking-[0.22em]">
                  感谢游戏连接彼此，也谢谢你跨越人海 与我们一起同行
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {(phase === "wipe-in" || phase === "wipe-out") && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-20 bg-accent will-change-[width,transform]"
          style={wipeStyle}
          aria-hidden
        />
      )}
    </div>
  );
}
