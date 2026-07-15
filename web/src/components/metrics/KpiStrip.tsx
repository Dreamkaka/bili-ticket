"use client";

import { memo } from "react";

const ITEMS = [
  { key: "projects", en: "01", label: "监控项目" },
  { key: "available", en: "02", label: "可售票档" },
  { key: "online", en: "03", label: "在线节点" },
  { key: "events", en: "04", label: "最近变动" },
] as const;

export const KpiStrip = memo(function KpiStrip({
  projects,
  available,
  online,
  events,
}: {
  projects: number;
  available: number;
  online: number;
  events: number;
}) {
  const values = { projects, available, online, events };

  return (
    <div className="grid grid-cols-2 gap-px bg-[var(--hairline)] lg:grid-cols-4">
      {ITEMS.map((item) => (
        <div
          key={item.key}
          className="theme-panel px-3 py-4 transition-colors duration-300 hover:bg-[var(--panel-strong)] sm:px-5 sm:py-5"
        >
          <div className="theme-ink-faint flex items-center gap-1.5 text-[9px] tracking-[0.16em] sm:gap-2 sm:text-[10px] sm:tracking-[0.2em]">
            <span className="text-accent">{item.en}</span>
            <span>{item.label}</span>
          </div>
          <p
            key={`${item.key}-${values[item.key]}`}
            className="theme-ink animate-fade-in-up mt-2 text-2xl font-light tracking-tight tabular-nums sm:mt-3 sm:text-3xl"
          >
            {values[item.key]}
          </p>
        </div>
      ))}
    </div>
  );
});
