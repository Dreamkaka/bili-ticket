"use client";

import { useState } from "react";
import { Chip } from "@heroui/react";
import type { Diff } from "@/lib/types";
import { formatAkDateTime } from "@/lib/status";
import {
  FEED_FILTERS,
  filterDiffs,
  tagForDiff,
  type FeedFilter,
} from "@/lib/diff";

export function EventStream({
  diffs,
  onSelectDiff,
}: {
  diffs: Diff[];
  onSelectDiff?: (diff: Diff) => void;
}) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const list = filterDiffs(diffs, filter).slice(0, 40);

  return (
    <div id="events" className="theme-panel section-block border">
      <div className="theme-hairline flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.25em] text-accent">EVENTS</p>
          <p className="theme-ink mt-1 text-sm font-medium">实时事件流</p>
          <p className="theme-ink-faint mt-0.5 text-xs">主显示区 · 最近状态变动</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {FEED_FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-2.5 py-1 text-xs font-medium transition-all duration-300 ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "theme-ink-faint border border-[var(--hairline)] hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="theme-ink-faint flex min-h-40 items-center justify-center px-5 py-10 text-sm">
          暂无事件
        </div>
      ) : (
        <div className="max-h-[520px] divide-y divide-[var(--hairline)] overflow-y-auto">
          {list.map((diff, i) => {
            const tag = tagForDiff(diff);
            return (
              <button
                key={diff.id}
                type="button"
                onClick={() => onSelectDiff?.(diff)}
                style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                className="stagger-item group flex w-full gap-3 px-5 py-3.5 text-left transition-colors duration-300 hover:bg-[var(--panel-strong)] sm:gap-4"
              >
                {diff.project_cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={diff.project_cover}
                    alt=""
                    className="hidden h-12 w-9 shrink-0 object-cover ring-1 ring-[var(--hairline)] sm:block"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip size="sm" variant="soft" color={tag.tone} className="rounded-sm">
                      {tag.label}
                    </Chip>
                    {diff.project_name && (
                      <span className="theme-ink-faint truncate text-xs">
                        {diff.project_name}
                        {diff.project_venue ? ` · ${diff.project_venue}` : ""}
                      </span>
                    )}
                    <span className="theme-ink-faint ak-date ml-auto text-[10px]">
                      {formatAkDateTime(diff.ts)}
                    </span>
                  </div>
                  <p
                    className="theme-ink mt-1.5 line-clamp-2 break-all text-sm font-medium group-hover:text-accent"
                    title={diff.ticket_name}
                  >
                    {diff.ticket_name}
                  </p>
                  <div className="theme-ink-faint mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="line-through">{diff.old_status}</span>
                    <span className="text-accent">→</span>
                    <span className="theme-ink-soft">{diff.new_status}</span>
                    {diff.less_vt >= 0 && (
                      <span className="ml-auto">
                        库存 <strong className="text-accent">{diff.less_vt}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="theme-hairline theme-ink-faint border-t px-5 py-2.5 font-mono text-[10px] tracking-wider">
        SHOWING // {list.length} / {diffs.length} RECORDS
      </div>
    </div>
  );
}
