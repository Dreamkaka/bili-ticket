"use client";

import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";

type Layer = {
  key: string;
  cover: string | null;
  entering: boolean;
};

export function PageBackground({ project }: { project?: Project | null }) {
  const [layers, setLayers] = useState<Layer[]>(() => [
    {
      key: project?.id ?? "empty",
      cover: project?.cover ?? null,
      entering: false,
    },
  ]);
  const prevIdRef = useRef(project?.id ?? "empty");

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

    setLayers((prev) => {
      const base = prev.slice(-1);
      return [
        ...base.map((l) => ({ ...l, entering: false })),
        { key: nextKey, cover: nextCover, entering: true },
      ];
    });

    const t = window.setTimeout(() => {
      setLayers((prev) => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        return [{ ...last, entering: false }];
      });
    }, 950);

    return () => window.clearTimeout(t);
  }, [project?.id, project?.cover]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 h-[100dvh] min-h-full w-full overflow-hidden"
      aria-hidden
    >
      {layers.map((layer) => (
        <div
          key={layer.key}
          className={`bg-layer ${layer.entering ? "bg-layer--enter" : "bg-layer--idle"}`}
        >
          {layer.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={layer.cover} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="bg-fallback bg-gradient-to-br from-slate-200 via-blue-100 to-slate-300 dark:from-slate-950 dark:via-blue-950/50 dark:to-black" />
          )}
        </div>
      ))}

      <div className="absolute inset-0 bg-[var(--scrim-base)] transition-colors duration-500" />
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--scrim-strong)] via-[var(--scrim)] to-[var(--scrim-strong)]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--scrim)] via-transparent to-[var(--scrim)]" />
      <div className="ak-dots absolute inset-0 opacity-25" />
    </div>
  );
}
