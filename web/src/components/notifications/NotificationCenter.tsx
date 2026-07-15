"use client";

import { useMemo, useState } from "react";
import { Chip, Modal } from "@heroui/react";
import type { Diff } from "@/lib/types";
import { formatAkDateTime } from "@/lib/status";
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
      if (diff.project_id) scrollToId(`project-${diff.project_id}`);
      else scrollToId("projects");
    }, 40);
  };

  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={onOpenChange}
      variant="blur"
      className="z-[10000]"
    >
      <Modal.Container className="items-center justify-center" placement="center">
        <Modal.Dialog
          aria-label="票务通知"
          className="theme-panel mx-auto mb-[env(safe-area-inset-bottom,0px)] w-[min(100vw-1rem,28rem)] overflow-hidden rounded-sm border p-0 shadow-2xl"
        >
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

          <div className="theme-hairline flex flex-wrap gap-1 border-b px-4 py-2.5">
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
                      : "theme-ink-faint border border-[var(--hairline)] hover:text-ink"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="max-h-[min(65dvh,24rem)] overflow-y-auto">
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
                        <Chip
                          size="sm"
                          variant="soft"
                          color={tag.tone}
                          className="rounded-sm"
                        >
                          {tag.label}
                        </Chip>
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
              href="#events"
              onClick={() => onOpenChange(false)}
              className="text-[11px] tracking-wider text-accent/90 hover:text-accent"
            >
              查看完整事件流 ↓
            </a>
            <span className="theme-ink-faint font-mono text-[10px]">
              {list.length} / {diffs.length}
            </span>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
