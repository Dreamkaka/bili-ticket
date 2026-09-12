"use client";

import { memo, useEffect, useState } from "react";
import Link from "next/link";
import type { FeaturedInfo } from "@/lib/featured";
import type { Ticket } from "@/lib/types";
import { formatClock, isAvailableStatus } from "@/lib/status";
import { useCountdown } from "@/hooks/useCountdown";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { ConnectionStatus } from "@/lib/types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const CountdownCell = memo(function CountdownCell({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="min-w-0 flex-1 overflow-hidden border border-[var(--hairline)] bg-[var(--panel-strong)] px-2 py-2.5 text-center">
      <p
        key={value}
        className="digit-flip text-xl leading-none font-light tabular-nums sm:text-3xl"
      >
        {value}
      </p>
      <p className="theme-ink-faint mt-1.5 text-[9px] tracking-[0.18em] sm:text-[10px]">
        {label}
      </p>
    </div>
  );
});

type CoverLayer = {
  key: string;
  cover: string | null;
  phase: "enter" | "idle";
};

export const ExhibitionHero = memo(function ExhibitionHero({
  featured,
  tickets,
  loading,
  connectionStatus,
  systemHealthy,
  lastUpdate,
  availableTickets,
  onlineNodes,
  projectCount,
  eventCount,
  focusIndex = 1,
  projectTotal = 1,
  userLocked = false,
  onResumeAutoplay,
}: {
  featured: FeaturedInfo | null;
  tickets: Ticket[];
  loading: boolean;
  connectionStatus: ConnectionStatus;
  systemHealthy: boolean;
  lastUpdate: number | null;
  availableTickets: number;
  onlineNodes: number;
  projectCount: number;
  eventCount: number;
  focusIndex?: number;
  projectTotal?: number;
  userLocked?: boolean;
  cycle?: number;
  onResumeAutoplay?: () => void;
}) {
  const project = featured?.project ?? null;
  const phase = featured?.phase ?? "unknown";
  const targetMs =
    phase === "ongoing" ? featured?.endingMs : featured?.openingMs;
  const countdown = useCountdown(phase === "ended" ? null : (targetMs ?? null));
  const available = tickets.filter((t) => isAvailableStatus(t.status)).length;
  const ratio = tickets.length > 0 ? available / tickets.length : 0;
  const [covers, setCovers] = useState<CoverLayer[]>(() => [
    {
      key: project?.id ?? "empty",
      cover: project?.cover ?? null,
      phase: "idle",
    },
  ]);

  useEffect(() => {
    const nextKey = project?.id ?? "empty";
    const nextCover = project?.cover ?? null;
    setCovers((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.key === nextKey && last.cover === nextCover) return prev;
      const base = prev.slice(-1).map((layer) => ({ ...layer, phase: "idle" as const }));
      return [...base, { key: nextKey, cover: nextCover, phase: "enter" }];
    });
    const timer = window.setTimeout(() => {
      setCovers((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.key !== nextKey) return prev;
        return [{ ...last, phase: "idle" }];
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [project?.id, project?.cover]);

  const dateText =
    featured?.range && phase !== "unknown"
      ? featured.range.start.year === featured.range.end.year &&
        featured.range.start.month === featured.range.end.month &&
        featured.range.start.day === featured.range.end.day
        ? `${featured.range.start.year} / ${pad(featured.range.start.month)} / ${pad(featured.range.start.day)}`
        : `${featured.range.start.year} / ${pad(featured.range.start.month)} / ${pad(featured.range.start.day)} — ${pad(featured.range.end.month)} / ${pad(featured.range.end.day)}`
      : (project?.project_label ?? "");

  const connLabel =
    connectionStatus === "connected"
      ? "LINKED"
      : connectionStatus === "connecting"
        ? "SYNC"
        : "LOST";

  const animKey = project?.id ?? "empty";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-[160px] flex-[1.15] overflow-hidden sm:min-h-[220px] sm:flex-[1.4]">
        {covers.map((layer) => (
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
              <div className="bg-media bg-gradient-to-br from-slate-200 via-blue-100 to-slate-300 dark:from-slate-950 dark:via-blue-950/50 dark:to-black" />
            )}
          </div>
        ))}
        <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/15" />
        </div>
        <div className="absolute inset-x-0 bottom-0 z-[2] p-4 sm:p-5 md:p-6">
          {loading && !project ? (
            <div className="flex items-center gap-3 text-sm text-white/80">
              <Spinner size={18} className="text-accent" />
              等待网关数据…
            </div>
          ) : (
            <div key={animKey}>
              <div className="animate-fade-in-left mb-2 flex flex-wrap items-center gap-2">
                {project && (
                  <span className="bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wider text-accent-foreground uppercase">
                    {project.type}
                  </span>
                )}
                {phase === "upcoming" && <Badge tone="accent">即将开幕</Badge>}
                {phase === "ongoing" && <Badge tone="success">进行中</Badge>}
                {phase === "ended" && <Badge>已闭幕</Badge>}
              </div>
              <h1
                className="animate-fade-in-up line-clamp-3 text-xl leading-snug font-bold tracking-wide text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.75)] sm:text-3xl"
                title={project?.name || undefined}
              >
                {project?.name || "等待监控数据"}
              </h1>
              <div className="animate-fade-in-up anim-delay-1 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/85 sm:text-sm">
                {dateText && <span className="ak-date">{dateText}</span>}
                <span className="max-w-[18rem] truncate">
                  {project?.venue_name || "场地信息加载中…"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--hairline)] px-4 py-3 sm:px-5 sm:py-4 md:px-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.1em] text-[var(--ink-faint)] uppercase">
            {phase === "ongoing" ? "距闭幕" : "距开幕"}
          </span>
          <span className="h-px flex-1 bg-[var(--hairline)]" />
        </div>
        {project && phase !== "unknown" && phase !== "ended" ? (
          <div key={animKey} className="animate-fade-in-up flex items-stretch gap-1.5">
            <CountdownCell value={String(countdown.days)} label="天 DAYS" />
            <CountdownCell value={pad(countdown.hours)} label="时 HRS" />
            <CountdownCell value={pad(countdown.minutes)} label="分 MIN" />
            <CountdownCell value={pad(countdown.seconds)} label="秒 SEC" />
          </div>
        ) : (
          <p className="ak-date border border-[var(--hairline)] px-4 py-3 text-xs tracking-[0.2em] text-[var(--ink-faint)]">
            {phase === "ended" ? "ENDED // 已闭幕" : "WAITING // 暂无日期"}
          </p>
        )}
      </div>

      <div className="border-t border-[var(--hairline)] px-4 py-3 sm:px-5 sm:py-4 md:px-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.1em] text-[var(--ink-faint)] uppercase">
            status
          </span>
          <span className="h-px flex-1 bg-[var(--hairline)]" />
          <span className="font-mono text-[10px] text-[var(--ink-faint)]">
            {lastUpdate ? formatClock(lastUpdate) : "--:--:--"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatusCell label="连接" value={connLabel} accent={connectionStatus === "connected"} />
          <StatusCell label="系统" value={systemHealthy ? "NOMINAL" : "ALERT"} accent={systemHealthy} />
          <StatusCell label="项目" value={String(projectCount)} />
          <StatusCell label="可售" value={`${availableTickets}`} />
          <StatusCell label="节点" value={String(onlineNodes)} />
          <StatusCell label="事件" value={String(eventCount)} />
        </div>
        {tickets.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between font-mono text-[10px] text-[var(--ink-faint)]">
              <span>主展会可售</span>
              <span>
                {available} / {tickets.length}
              </span>
            </div>
            <div className="h-1 overflow-hidden bg-[var(--hairline)]">
              <div
                className="h-full bg-accent transition-[width] duration-700"
                style={{ width: `${Math.max(ratio * 100, 2)}%` }}
              />
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <a
              href="#pane-tickets"
              className="font-mono text-[13px] text-accent transition-colors hover:text-accent/70"
            >
              查看票档 -&gt;
            </a>
            <Link
              href="/guides"
              className="font-mono text-[13px] text-[var(--ink-faint)] transition-colors hover:text-accent"
            >
              购票攻略 -&gt;
            </Link>
          </div>
          <div className="font-mono text-[10px] tracking-[0.14em] text-[var(--ink-faint)]">
            {String(focusIndex).padStart(2, "0")} // {String(Math.max(projectTotal, 1)).padStart(2, "0")}
            {userLocked && onResumeAutoplay ? (
              <button
                type="button"
                onClick={onResumeAutoplay}
                className="ml-3 text-accent hover:underline"
              >
                恢复轮播
              </button>
            ) : (
              <span className="ml-3">AUTO</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

function StatusCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] tracking-[0.1em] text-[var(--ink-faint)] uppercase">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-[15px] leading-none tracking-tight tabular-nums ${
          accent ? "text-accent" : "theme-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
