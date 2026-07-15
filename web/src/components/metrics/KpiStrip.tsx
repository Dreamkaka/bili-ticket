"use client";

const ITEMS = [
  { key: "projects", en: "01", label: "监控项目" },
  { key: "available", en: "02", label: "可售票档" },
  { key: "online", en: "03", label: "在线节点" },
  { key: "events", en: "04", label: "最近变动" },
] as const;

export function KpiStrip({
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
          className="theme-panel px-5 py-5 transition-colors duration-300 hover:bg-[var(--panel-strong)]"
        >
          <div className="theme-ink-faint flex items-center gap-2 text-[10px] tracking-[0.2em]">
            <span className="text-accent">{item.en}</span>
            <span>{item.label}</span>
          </div>
          <p
            key={`${item.key}-${values[item.key]}`}
            className="theme-ink animate-fade-in-up mt-3 text-3xl font-light tracking-tight tabular-nums"
          >
            {values[item.key]}
          </p>
        </div>
      ))}
    </div>
  );
}
