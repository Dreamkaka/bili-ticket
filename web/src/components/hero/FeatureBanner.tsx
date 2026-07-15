"use client";

import { memo } from "react";
import { Button, Chip } from "@heroui/react";
import type { Project, Ticket } from "@/lib/types";
import { isAvailableStatus, padIndex } from "@/lib/status";

const HeroReadabilityScrim = memo(function HeroReadabilityScrim() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
      <div className="absolute inset-y-0 left-0 w-[min(100%,48rem)] bg-gradient-to-r from-black/50 via-black/15 to-transparent" />
    </div>
  );
});

export const FeatureBanner = memo(function FeatureBanner({
  project,
  tickets,
  index,
  total,
  userLocked = false,
  onResumeAutoplay,
  registerProgressEl,
  onOpenProject,
}: {
  project: Project | null;
  tickets: Ticket[];
  index: number;
  total: number;
  userLocked?: boolean;
  onResumeAutoplay?: () => void;
  registerProgressEl?: (el: HTMLElement | null) => void;
  onOpenProject?: () => void;
}) {
  const available = tickets.filter((t) => isAvailableStatus(t.status)).length;
  const ratio = tickets.length > 0 ? available / tickets.length : 0;
  const animKey = project?.id ?? "empty";

  return (
    <div className="relative flex h-full w-full flex-col justify-end overflow-hidden p-6 sm:p-10 lg:p-12 lg:pb-16">
      <HeroReadabilityScrim />

      {/* BREAKING：左下大水印，在文案下方层级 */}
      <div
        key={`breaking-${animKey}`}
        className="pointer-events-none absolute bottom-4 left-4 z-0 select-none sm:bottom-6 sm:left-8 lg:bottom-8 lg:left-10"
        aria-hidden
      >
        <span className="animate-fade-in-scale block text-[clamp(3rem,12vw,8rem)] leading-[0.85] font-black tracking-tighter text-white/[0.07]">
          BREAKING
        </span>
      </div>

      {/* 全部信息左下 */}
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
          className="animate-fade-in-up anim-delay-1 line-clamp-3 break-all text-2xl font-bold leading-tight tracking-wide text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)] sm:text-4xl lg:text-5xl"
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

        <div className="animate-fade-in-up anim-delay-3 mt-4 flex flex-wrap items-center gap-3">
          <Button
            className="rounded-none bg-accent px-5 font-semibold text-accent-foreground shadow-lg transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]"
            onPress={onOpenProject}
            isDisabled={!project || !onOpenProject}
          >
            查看票档
            <span className="ml-2 opacity-70">›</span>
          </Button>
          {project ? (
            <Chip
              key={animKey}
              size="sm"
              variant="soft"
              className="rounded-sm border border-white/15 bg-black/35 text-white/90 backdrop-blur-sm"
            >
              ID {project.id}
            </Chip>
          ) : null}
        </div>

        <div className="animate-fade-in-up anim-delay-4 mt-6 max-w-md space-y-2">
          <div className="h-0.5 overflow-hidden bg-white/20">
            <div
              className="h-full bg-accent transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(ratio * 100, total > 0 ? 8 : 0)}%` }}
            />
          </div>
          {!userLocked && total > 1 && (
            <div className="h-0.5 overflow-hidden bg-white/15">
              <div
                ref={registerProgressEl}
                className="h-full bg-white/60 will-change-[width]"
                style={{ width: "0%" }}
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
      </div>

      {/* 独立右下项目计数 */}
      <div
        key={`counter-${animKey}`}
        className="animate-fade-in-scale anim-delay-3 absolute right-6 bottom-8 z-[2] shrink-0 text-right sm:right-10 sm:bottom-10 lg:right-12 lg:bottom-14"
      >
        <div className="flex items-baseline justify-end gap-1.5">
          <span className="text-3xl font-light text-accent tabular-nums drop-shadow sm:text-4xl">
            {padIndex(index)}
          </span>
          <span className="text-xs tracking-[0.2em] text-white/55">
            // {padIndex(Math.max(total, 1))}
          </span>
        </div>
        <div className="mt-1 text-[10px] tracking-[0.3em] text-white/45">
          PROJECTS
        </div>
      </div>
    </div>
  );
});
