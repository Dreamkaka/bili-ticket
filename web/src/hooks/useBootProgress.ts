"use client";

import { useEffect, useRef, useState } from "react";
import type { ConnectionStatus } from "@/lib/types";

const MIN_MS = 1400;
const MAX_MS = 8000;
const FAKE_CAP = 0.9;
const FINISH_MS = 280;
const WIPE_IN_MS = 420;
const WIPE_OUT_MS = 520;

export type BootPhase =
  | "loading"
  | "finishing"
  | "wipe-in"
  | "wipe-out"
  | "done";

export function useBootProgress({
  ready,
  connectionStatus,
  onPhaseChange,
  onDone,
}: {
  ready: boolean;
  connectionStatus: ConnectionStatus;
  onPhaseChange?: (phase: BootPhase) => void;
  onDone: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<BootPhase>("loading");
  const [wipe, setWipe] = useState(0);

  const startRef = useRef(0);
  const progressRef = useRef(0);
  const phaseRef = useRef<BootPhase>("loading");
  const readyRef = useRef(ready);
  const onDoneRef = useRef(onDone);
  const onPhaseRef = useRef(onPhaseChange);
  const segmentStartRef = useRef(0);
  const finishFromRef = useRef(0);
  const doneOnce = useRef(false);

  readyRef.current = ready;
  onDoneRef.current = onDone;
  onPhaseRef.current = onPhaseChange;
  progressRef.current = progress;

  const goPhase = (next: BootPhase, now?: number) => {
    phaseRef.current = next;
    setPhase(next);
    onPhaseRef.current?.(next);
    if (now != null) segmentStartRef.current = now;
  };

  useEffect(() => {
    startRef.current = performance.now();
    onPhaseRef.current?.("loading");
    let raf = 0;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const currentPhase = phaseRef.current;

      if (currentPhase === "loading") {
        const t = Math.min(1, elapsed / (MIN_MS * 1.35));
        const eased = 1 - Math.pow(1 - t, 2.4);
        const next = Math.min(FAKE_CAP, eased * FAKE_CAP);
        const crawl =
          next >= FAKE_CAP - 0.001
            ? FAKE_CAP + Math.min(0.04, (elapsed - MIN_MS) * 0.00002)
            : next;
        const value = Math.min(0.94, crawl);

        progressRef.current = value;
        setProgress(value);

        const canFinish =
          (readyRef.current || elapsed >= MAX_MS) && elapsed >= MIN_MS;

        if (canFinish) {
          finishFromRef.current = value;
          goPhase("finishing", now);
        }
      } else if (currentPhase === "finishing") {
        const ft = Math.min(1, (now - segmentStartRef.current) / FINISH_MS);
        const eased = easeOutCubic(ft);
        const value =
          finishFromRef.current + (1 - finishFromRef.current) * eased;
        progressRef.current = value;
        setProgress(value);

        if (ft >= 1) {
          setWipe(0);
          goPhase("wipe-in", now);
        }
      } else if (currentPhase === "wipe-in") {
        const wt = Math.min(1, (now - segmentStartRef.current) / WIPE_IN_MS);
        const eased = easeInOutCubic(wt);
        setWipe(eased);

        if (wt >= 1) {
          setWipe(0);
          goPhase("wipe-out", now);
        }
      } else if (currentPhase === "wipe-out") {
        const wt = Math.min(1, (now - segmentStartRef.current) / WIPE_OUT_MS);
        const eased = easeInOutCubic(wt);
        setWipe(eased);

        if (wt >= 1 && !doneOnce.current) {
          doneOnce.current = true;
          goPhase("done");
          onDoneRef.current();
          return;
        }
      } else {
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    void connectionStatus;
  }, [connectionStatus]);

  return {
    progress,
    percent: Math.min(100, Math.round(progress * 100)),
    phase,
    wipe,
  };
}
