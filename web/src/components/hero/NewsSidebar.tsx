"use client";

import { Button, Chip } from "@heroui/react";
import type { Diff, Project, Ticket } from "@/lib/types";
import {
  formatAkDate,
  formatAkDateTime,
  isAvailableStatus,
} from "@/lib/status";
import {
  FEED_FILTERS,
  filterDiffs,
  tagForDiff,
  type FeedFilter,
} from "@/lib/diff";

export type { FeedFilter };

export function NewsSidebar({
  diffs,
  filter,
  onFilterChange,
  focusProject,
  focusTickets,
  onSelectDiff,
  onOpenProject,
  expanded,
  onExpandedChange,
}: {
  diffs: Diff[];
  filter: FeedFilter;
  onFilterChange: (f: FeedFilter) => void;
  focusProject: Project | null;
  focusTickets: Ticket[];
  onSelectDiff: (diff: Diff) => void;
  onOpenProject: () => void;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
}) {
  const filtered = filterDiffs(diffs, filter);
  const list = filtered.slice(0, 6);
  const availableCount = focusTickets.filter((t) => isAvailableStatus(t.status)).length;
  const focusKey = focusProject?.id ?? "none";
  const latest = diffs[0];

  return (
    <div className="theme-panel relative flex h-full flex-col border-r">
      <div className="ak-dots pointer-events-none absolute inset-0 opacity-30" />

      <div className="relative z-10 flex h-full flex-col p-4 sm:p-5 lg:p-6">
        <div className="theme-hairline flex items-center justify-between gap-3 border-b pb-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.25em] text-accent">FEED</p>
            <p className="theme-ink mt-0.5 text-sm font-medium">票务动态</p>
          </div>
          <button
            type="button"
            onClick={() => onExpandedChange(!expanded)}
            className="theme-ink-soft shrink-0 border border-[var(--hairline)] bg-[var(--panel-strong)] px-3 py-1.5 text-[11px] tracking-wider transition-all duration-300 hover:border-accent/40 hover:text-accent"
            aria-expanded={expanded}
          >
            {expanded ? "收起 ›" : "展开 ›"}
          </button>
        </div>

        <div
          className={`grid transition-all duration-500 ease-out ${
            expanded ? "mt-0 max-h-0 opacity-0" : "mt-4 max-h-40 opacity-100"
          } overflow-hidden`}
        >
          <button
            type="button"
            onClick={() => onExpandedChange(true)}
            className="theme-panel-strong w-full border border-[var(--hairline)] p-3 text-left transition-colors duration-300 hover:border-accent/30"
          >
            {latest ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-bold tracking-wider ${
                      tagForDiff(latest).tone === "accent"
                        ? "text-accent"
                        : tagForDiff(latest).tone === "danger"
                          ? "text-danger"
                          : "theme-ink-faint"
                    }`}
                  >
                    {tagForDiff(latest).label}
                  </span>
                  <span className="theme-ink-faint ak-date text-[10px]">
                    {formatAkDate(latest.ts)}
                  </span>
                </div>
                <p className="theme-ink mt-1.5 truncate text-sm">{latest.ticket_name}</p>
                <p className="theme-ink-faint mt-1 text-[11px]">
                  共 {diffs.length} 条 · 点击展开预览
                </p>
              </>
            ) : (
              <p className="theme-ink-faint text-xs tracking-wider">暂无动态 · 点击展开</p>
            )}
          </button>
        </div>

        <div
          className={`grid transition-all duration-500 ease-out ${
            expanded ? "mt-3 max-h-[70vh] opacity-100" : "mt-0 max-h-0 opacity-0"
          } overflow-hidden`}
        >
          <div className="flex min-h-0 flex-col">
            <div className="theme-hairline flex flex-wrap gap-1 border-b pb-3">
              {FEED_FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onFilterChange(f.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-all duration-300 ease-out ${
                      active
                        ? "bg-accent text-accent-foreground shadow-[0_0_16px_-4px_var(--accent)]"
                        : "theme-ink-faint hover:bg-[var(--panel-strong)] hover:text-ink"
                    }`}
                  >
                    {f.label}
                    <span
                      className={`text-[10px] transition-all duration-300 ${
                        active ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0"
                      }`}
                    >
                      ›
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              key={filter}
              className="mt-2 max-h-[28vh] flex-1 space-y-0 overflow-y-auto lg:max-h-[36vh]"
            >
              {list.length === 0 ? (
                <p className="theme-ink-faint animate-fade-in py-6 text-center text-xs tracking-wider">
                  暂无符合条件的动态
                </p>
              ) : (
                list.map((diff, i) => {
                  const tag = tagForDiff(diff);
                  return (
                    <button
                      key={diff.id}
                      type="button"
                      onClick={() => onSelectDiff(diff)}
                      style={{ animationDelay: `${Math.min(i, 5) * 45}ms` }}
                      className="stagger-item theme-hairline group flex w-full gap-3 border-b py-3 text-left transition-colors duration-300 hover:bg-[var(--panel-strong)]"
                    >
                      <span
                        className={`mt-0.5 shrink-0 text-[10px] font-bold tracking-wider ${
                          tag.tone === "accent"
                            ? "text-accent"
                            : tag.tone === "danger"
                              ? "text-danger"
                              : "theme-ink-faint"
                        }`}
                      >
                        {tag.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="theme-ink-faint ak-date text-[10px]">
                          {formatAkDate(diff.ts)}
                        </div>
                        <div className="theme-ink mt-1 truncate text-sm group-hover:text-accent">
                          {diff.ticket_name}
                        </div>
                        <div className="theme-ink-faint mt-0.5 truncate text-[11px]">
                          {diff.old_status} → {diff.new_status}
                          {diff.less_vt >= 0 ? ` · 余 ${diff.less_vt}` : ""}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <a
              href="#events"
              className="mt-3 block text-center text-[11px] tracking-wider text-accent/80 transition hover:text-accent"
            >
              查看完整事件流 ↓
            </a>
          </div>
        </div>

        <div className="theme-hairline relative z-10 mt-auto border-t pt-5">
          <div key={focusKey} className="space-y-2">
            <div className="theme-ink-faint animate-fade-in-left ak-date text-[10px]">
              {focusProject
                ? formatAkDateTime(Math.floor(Date.now() / 1000))
                : "— // — / —"}
            </div>
            <h3
              className="theme-ink animate-fade-in-up anim-delay-1 line-clamp-2 break-all text-base font-semibold leading-snug sm:text-lg"
              title={focusProject?.name || undefined}
            >
              {focusProject?.name || "尚未选定焦点项目"}
            </h3>
            <p
              className="theme-ink-faint animate-fade-in-up anim-delay-2 truncate text-xs tracking-[0.12em] uppercase"
              title={
                focusProject
                  ? `${availableCount} / ${focusTickets.length} · ${[focusProject.project_label, focusProject.venue_name].filter(Boolean).join(" · ") || "N/A"}`
                  : undefined
              }
            >
              {focusProject
                ? `${availableCount} / ${focusTickets.length} available · ${[focusProject.project_label, focusProject.venue_name].filter(Boolean).join(" · ") || "N/A"}`
                : "LIVE TELEMETRY STANDBY"}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              className="rounded-none bg-accent px-5 font-semibold text-accent-foreground transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]"
              onPress={onOpenProject}
              isDisabled={!focusProject}
            >
              查看票档
              <span className="ml-2 opacity-70">›</span>
            </Button>
            {focusProject && (
              <Chip
                key={focusKey}
                size="sm"
                variant="soft"
                className="animate-fade-in-scale rounded-sm"
              >
                ID {focusProject.id}
              </Chip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
