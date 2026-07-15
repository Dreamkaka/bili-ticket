"use client";

import type { Project, Ticket } from "@/lib/types";
import { isAvailableStatus, padIndex } from "@/lib/status";

export function FeatureBanner({
  project,
  tickets,
  index,
  total,
  progress = 0,
  onResumeAutoplay,
  userLocked = false,
}: {
  project: Project | null;
  tickets: Ticket[];
  index: number;
  total: number;
  progress?: number;
  onResumeAutoplay?: () => void;
  userLocked?: boolean;
}) {
  const available = tickets.filter((t) => isAvailableStatus(t.status)).length;
  const ratio = tickets.length > 0 ? available / tickets.length : 0;
  const animKey = project?.id ?? "empty";

  return (
    <div className="relative flex h-full min-h-[420px] w-full flex-col justify-end p-6 sm:p-10 lg:min-h-0 lg:p-12">
      {/* 仅文字区域本地可读性，非全屏遮罩 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/55 via-black/20 to-transparent dark:from-black/60" />

      <div key={animKey} className="relative z-[1] w-full min-w-0 max-w-3xl">
        <div className="animate-fade-in-left mb-3 flex flex-wrap items-center gap-2">
          {project && (
            <span className="bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wider text-accent-foreground uppercase">
              {project.type}
            </span>
          )}
          {tickets.length > 0 && (
            <span className="border border-white/20 bg-black/40 px-2 py-0.5 text-[10px] tracking-wider text-white/90 backdrop-blur-sm">
              {available} / {tickets.length} 可售
            </span>
          )}
        </div>

        <h2
          className="animate-fade-in-up anim-delay-1 line-clamp-3 break-all text-2xl font-bold leading-tight tracking-wide text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:text-4xl lg:text-5xl"
          title={project?.name || undefined}
        >
          {project?.name || "等待监控数据"}
        </h2>
        <p
          className="animate-fade-in-up anim-delay-2 mt-3 truncate text-sm tracking-wide text-white/85 drop-shadow sm:text-base"
          title={
            [project?.project_label, project?.venue_name]
              .filter(Boolean)
              .join(" · ") || undefined
          }
        >
          {[project?.project_label, project?.venue_name]
            .filter(Boolean)
            .join(" · ") || "场地信息加载中…"}
        </p>
      </div>

      <div className="relative z-[1] mt-8 flex items-end justify-between gap-4">
        <div className="max-w-md flex-1 space-y-2">
          <div className="h-0.5 overflow-hidden bg-white/20">
            <div
              className="h-full bg-accent transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(ratio * 100, total > 0 ? 8 : 0)}%` }}
            />
          </div>
          {!userLocked && total > 1 && (
            <div className="h-0.5 overflow-hidden bg-white/15">
              <div
                className="h-full bg-white/60 will-change-[width]"
                style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
              />
            </div>
          )}
          {userLocked && onResumeAutoplay && (
            <button
              type="button"
              onClick={onResumeAutoplay}
              className="animate-fade-in text-[10px] tracking-[0.2em] text-white/60 transition-colors duration-300 hover:text-accent"
            >
              恢复自动轮播 ›
            </button>
          )}
        </div>

        <div key={`idx-${animKey}`} className="animate-fade-in-scale anim-delay-3 shrink-0 text-right">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-light text-accent tabular-nums drop-shadow sm:text-4xl">
              {padIndex(index)}
            </span>
            <span className="text-xs tracking-[0.2em] text-white/55">
              // {padIndex(Math.max(total, 1))}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] tracking-[0.25em] text-white/45">PROJECTS</div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 text-[clamp(3rem,10vw,7rem)] font-black tracking-tighter text-white/10 select-none lg:block"
        aria-hidden
      >
        BREAKING
      </div>
    </div>
  );
}
