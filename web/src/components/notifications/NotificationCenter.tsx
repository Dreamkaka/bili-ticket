"use client";

import { useMemo, useState } from "react";
import type { Diff } from "@/lib/types";
import { formatAkDateTime } from "@/lib/status";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import {
  FEED_FILTERS,
  filterDiffs,
  tagForDiff,
  type FeedFilter,
} from "@/lib/diff";
import { scrollToId } from "@/lib/command";

const PANEL_LIMIT = 40;

export function NotificationCenter({
  open,
  onOpenChange,
  diffs,
  onSelectDiff,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diffs: Diff[];
  onSelectDiff?: (diff: Diff) => void;
}) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const list = useMemo(
    () => filterDiffs(diffs, filter).slice(0, PANEL_LIMIT),
    [diffs, filter]
  );

  const runSelect = (diff: Diff) => {
    onOpenChange(false);
    window.setTimeout(() => {
      onSelectDiff?.(diff);
      scrollToId("pane-tickets");
    }, 40);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} label="票务通知">
      <div className="theme-panel-strong w-full overflow-hidden shadow-2xl sm:w-[min(100vw-1rem,28rem)]">
        <div className="theme-hairline flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.25em] text-accent">
              ALERTS
            </p>
            <p className="theme-ink mt-0.5 text-sm font-medium">票务通知</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="theme-ink-faint border border-[var(--hairline)] px-2 py-1 text-[10px] tracking-wider hover:text-accent"
          >
            ESC
          </button>
        </div>

        <div className="theme-hairline flex flex-wrap gap-1.5 border-b px-4 py-2.5">
          {FEED_FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "theme-ink-faint border border-[var(--hairline)] hover:border-accent/40 hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="thin-scroll max-h-[min(65dvh,24rem)] overflow-y-auto">
          {list.length === 0 ? (
            <p className="theme-ink-faint px-4 py-10 text-center text-sm">
              暂无通知
            </p>
          ) : (
            list.map((diff, index) => {
              const tag = tagForDiff(diff);
              return (
                <button
                  key={`${diff.id}-${diff.ts}`}
                  type="button"
                  data-cursor="pointer"
                  onClick={() => runSelect(diff)}
                  style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                  className="stagger-item theme-hairline flex w-full gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/10"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={tag.tone}>{tag.label}</Badge>
                      {diff.project_name ? (
                        <span className="theme-ink-faint truncate text-xs">
                          {diff.project_name}
                        </span>
                      ) : null}
                      <span className="theme-ink-faint ak-date ml-auto text-[10px]">
                        {formatAkDateTime(diff.ts)}
                      </span>
                    </div>
                    <p className="theme-ink mt-1.5 line-clamp-2 break-all text-sm font-medium">
                      {diff.ticket_name}
                    </p>
                    <p className="theme-ink-faint mt-1 text-xs">
                      <span className="line-through">{diff.old_status}</span>
                      <span className="mx-1 text-accent">→</span>
                      <span>{diff.new_status}</span>
                      {diff.less_vt >= 0 ? (
                        <span className="ml-2">
                          余 <strong className="text-accent">{diff.less_vt}</strong>
                        </span>
                      ) : null}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="theme-hairline flex items-center justify-between border-t px-4 py-2.5">
          <a
            href="#pane-events"
            onClick={(e) => {
              e.preventDefault();
              onOpenChange(false);
              window.setTimeout(() => scrollToId("pane-events"), 40);
            }}
            className="text-[11px] tracking-wider text-accent/90 hover:text-accent"
          >
            查看完整事件流 ↓
          </a>
          <span className="theme-ink-faint font-mono text-[10px]">
            {list.length} / {diffs.length}
          </span>
        </div>
      </div>
    </Modal>
  );
}
