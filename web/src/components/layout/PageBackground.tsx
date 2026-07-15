"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";

type Layer = {
  key: string;
  cover: string | null;
  phase: "enter" | "idle";
};

const BackgroundScrim = memo(function BackgroundScrim() {
  return (
    <div className="absolute inset-0 z-10" aria-hidden>
      {/* 独立静态遮罩，不参与图片切换状态更新。 */}
      <div className="absolute inset-0 bg-[var(--scrim-base)]" />
      <div className="absolute inset-0 bg-[var(--scrim)]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 80% at 50% 45%, transparent 0%, var(--scrim-strong) 100%)",
        }}
      />
      <div className="ak-dots absolute inset-0 opacity-20" />
    </div>
  );
});

function preload(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.referrerPolicy = "no-referrer";
    img.src = src;
  });
}

export const PageBackground = memo(function PageBackground({
  project,
}: {
  project?: Project | null;
}) {
  const [layers, setLayers] = useState<Layer[]>(() => [
    {
      key: project?.id ?? "empty",
      cover: project?.cover ?? null,
      phase: "idle",
    },
  ]);
  const prevIdRef = useRef(project?.id ?? "empty");
  const genRef = useRef(0);

  useEffect(() => {
    const nextKey = project?.id ?? "empty";
    const nextCover = project?.cover ?? null;

    if (nextKey === prevIdRef.current) {
      setLayers((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1]!;
        if (last.cover === nextCover) return prev;
        return [...prev.slice(0, -1), { ...last, cover: nextCover }];
      });
      return;
    }

    prevIdRef.current = nextKey;
    const gen = ++genRef.current;

    let cancelled = false;
    let cleanupTimer = 0;
    const run = async () => {
      if (nextCover) await preload(nextCover);
      if (cancelled || gen !== genRef.current) return;

      setLayers((prev) => {
        const base = prev.slice(-1).map((l) => ({ ...l, phase: "idle" as const }));
        return [...base, { key: nextKey, cover: nextCover, phase: "enter" }];
      });

      cleanupTimer = window.setTimeout(() => {
        if (gen !== genRef.current) return;
        setLayers((prev) => {
          const last = prev[prev.length - 1];
          if (!last || last.key !== nextKey) return prev;
          return [{ ...last, phase: "idle" }];
        });
      }, 950);
    };

    void run();
    return () => {
      cancelled = true;
      window.clearTimeout(cleanupTimer);
    };
  }, [project?.id, project?.cover]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 h-[100dvh] w-screen overflow-hidden"
      aria-hidden
    >
      {layers.map((layer) => (
        <div
          key={layer.key}
          className={`bg-layer ${
            layer.phase === "enter" ? "bg-layer--enter" : "bg-layer--idle"
          }`}
        >
          {layer.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={layer.cover}
              alt=""
              decoding="async"
              className="bg-media"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="bg-fallback bg-media bg-gradient-to-br from-slate-200 via-blue-100 to-slate-300 dark:from-slate-950 dark:via-blue-950/50 dark:to-black" />
          )}
        </div>
      ))}

      <BackgroundScrim />
    </div>
  );
});
