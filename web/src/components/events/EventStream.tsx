"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import { Chip } from "@heroui/react";
import type { Diff } from "@/lib/types";
import { formatAkDateTime } from "@/lib/status";
import {
  FEED_FILTERS,
  filterDiffs,
  tagForDiff,
  type FeedFilter,
} from "@/lib/diff";

/** 行高估算（含 padding），用于虚拟窗口 */
const ROW_H = 92;
const OVERSCAN = 8;
const VIEWPORT_H = 520;

const EventRow = memo(function EventRow({
  diff,
  onSelect,
}: {
  diff: Diff;
  onSelect?: (diff: Diff) => void;
}) {
  const tag = tagForDiff(diff);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(diff)}
      className="group flex h-full w-full gap-3 px-5 py-3.5 text-left transition-colors duration-200 hover:bg-[var(--panel-strong)] sm:gap-4"
    >
      {diff.project_cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={diff.project_cover}
          alt=""
          loading="lazy"
          decoding="async"
          className="hidden h-12 w-9 shrink-0 object-cover ring-1 ring-[var(--hairline)] sm:block"
          referrerPolicy="no-referrer"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Chip size="sm" variant="soft" color={tag.tone} className="rounded-sm">
            {tag.label}
          </Chip>
          {diff.project_name ? (
            <span className="theme-ink-faint truncate text-xs">
              {diff.project_name}
              {diff.project_venue ? ` · ${diff.project_venue}` : ""}
            </span>
          ) : null}
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
          {diff.less_vt >= 0 ? (
            <span className="ml-auto">
              库存 <strong className="text-accent">{diff.less_vt}</strong>
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
});

function useVirtualWindow(count: number, rowH: number, viewportH: number) {
  const [scrollTop, setScrollTop] = useState(0);
  const rafRef = useRef(0);

  const onScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setScrollTop(top));
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const totalH = count * rowH;
  const start = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN);
  const visible = Math.ceil(viewportH / rowH) + OVERSCAN * 2;
  const end = Math.min(count, start + visible);
  const offsetY = start * rowH;

  const resetScroll = useCallback(() => setScrollTop(0), []);

  return { onScroll, totalH, start, end, offsetY, resetScroll };
}

export const EventStream = memo(function EventStream({
  diffs,
  onSelectDiff,
}: {
  diffs: Diff[];
  onSelectDiff?: (diff: Diff) => void;
}) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const list = useMemo(() => filterDiffs(diffs, filter), [diffs, filter]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { onScroll, totalH, start, end, offsetY, resetScroll } = useVirtualWindow(
    list.length,
    ROW_H,
    VIEWPORT_H
  );

  // 过滤切换时回到顶部，避免窗口偏移错位
  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    resetScroll();
  }, [filter, resetScroll]);

  const slice = useMemo(() => list.slice(start, end), [list, start, end]);

  return (
    <div id="events" className="reveal-child theme-panel section-block border [--reveal-delay:180ms]">
      <div className="theme-hairline flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.25em] text-accent">
            EVENTS
          </p>
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
        <div
          ref={scrollerRef}
          className="overflow-y-auto overscroll-contain"
          style={{ height: VIEWPORT_H }}
          onScroll={onScroll}
        >
          <div style={{ height: totalH, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${offsetY}px)`,
              }}
            >
              {slice.map((diff, i) => (
                <div
                  key={`${diff.id}-${diff.ts}-${diff.ticket_id}-${start + i}`}
                  style={{ height: ROW_H }}
                  className="overflow-hidden border-b border-[var(--hairline)] last:border-b-0"
                >
                  <EventRow diff={diff} onSelect={onSelectDiff} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="theme-hairline theme-ink-faint border-t px-5 py-2.5 font-mono text-[10px] tracking-wider">
        SHOWING // {list.length} / {diffs.length} RECORDS
        {list.length > 0 ? ` · VIS ${start + 1}-${end}` : ""}
      </div>
    </div>
  );
});
