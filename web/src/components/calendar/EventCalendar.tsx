"use client";

import { memo, useMemo, useState } from "react";
import {
  getLocalTimeZone,
  today,
  type CalendarDate,
} from "@internationalized/date";
import type { Project, Ticket } from "@/lib/types";
import {
  buildEventDateMap,
  countEventDays,
  dateKey,
  formatAkDateFromCalendar,
  pickInitialFocus,
} from "@/lib/project-date";
import { isAvailableStatus } from "@/lib/status";
import { scrollToId } from "@/lib/command";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function calendarSignature(projects: Project[]): string {
  return projects
    .map((p) => `${p.id}:${p.project_label ?? ""}`)
    .sort()
    .join("|");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function calFromKey(key: string): CalendarDate {
  const [y, m, d] = key.split("-").map(Number);
  return { year: y, month: m, day: d } as CalendarDate;
}

export const EventCalendar = memo(function EventCalendar({
  projects,
  tickets = [],
  onSelectProject,
}: {
  projects: Project[];
  tickets?: Ticket[];
  onSelectProject?: (id: string) => void;
}) {
  const calSig = useMemo(() => calendarSignature(projects), [projects]);
  const eventMap = useMemo(
    () => buildEventDateMap(projects),
    // 仅 label/id 变化时重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calSig]
  );
  const eventDayCount = countEventDays(eventMap);

  const todayDate = today(getLocalTimeZone());
  const initial = useMemo(
    () => pickInitialFocus(eventMap, todayDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calSig]
  );

  const [view, setView] = useState({ year: initial.year, month: initial.month });
  const [selectedKey, setSelectedKey] = useState<string | null>(
    dateKey(initial)
  );

  const ticketsByProject = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    for (const t of tickets) {
      const list = map.get(t.project_id);
      if (list) list.push(t);
      else map.set(t.project_id, [t]);
    }
    return map;
  }, [tickets]);

  const dayProjects = selectedKey ? eventMap.get(selectedKey) ?? [] : [];

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const idx = v.year * 12 + (v.month - 1) + delta;
      return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
    });
  };

  const goToday = () => {
    setView({ year: todayDate.year, month: todayDate.month });
    setSelectedKey(dateKey(todayDate));
  };

  // 月历单元格：周一开头
  const cells = useMemo(() => {
    const firstWeekday = (new Date(view.year, view.month - 1, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(view.year, view.month, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(`${view.year}-${pad(view.month)}-${pad(d)}`);
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  const openProject = (project: Project) => {
    onSelectProject?.(project.id);
    scrollToId("pane-projects");
    window.setTimeout(() => scrollToId(`project-${project.id}`), 40);
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 min-[900px]:grid-cols-12">
      <div className="reveal-child ak-panel min-w-0 p-3 sm:p-4 min-[900px]:col-span-5 [--reveal-delay:100ms]">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <p className="theme-ink text-sm font-semibold tracking-wide tabular-nums">
            {view.year} / {pad(view.month)}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={goToday}
              className="theme-ink-faint border border-[var(--hairline)] px-2 py-1 text-[10px] tracking-wider transition-colors hover:border-accent/50 hover:text-accent"
            >
              今天
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="theme-ink-faint flex h-7 w-7 items-center justify-center border border-[var(--hairline)] transition-colors hover:border-accent/50 hover:text-accent"
              aria-label="上个月"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="theme-ink-faint flex h-7 w-7 items-center justify-center border border-[var(--hairline)] transition-colors hover:border-accent/50 hover:text-accent"
              aria-label="下个月"
            >
              ›
            </button>
          </div>
        </div>

        <div
          className="grid grid-cols-7 gap-1 text-center"
          role="grid"
          aria-label="活动日历"
        >
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="theme-ink-faint py-1 text-[10px] font-medium tracking-wider"
            >
              {w}
            </div>
          ))}
          {cells.map((key, i) => {
            if (!key) return <div key={`e-${i}`} aria-hidden />;
            const day = Number(key.slice(-2));
            const hasEvent = eventMap.has(key);
            const isToday = key === dateKey(todayDate);
            const isSelected = key === selectedKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(key)}
                aria-label={key}
                aria-pressed={isSelected}
                className={`relative flex aspect-square items-center justify-center text-xs tabular-nums transition-colors duration-200 ${
                  isSelected
                    ? "bg-accent font-semibold text-accent-foreground"
                    : hasEvent
                      ? "theme-ink font-semibold hover:bg-accent/15"
                      : "theme-ink-soft hover:bg-[var(--surface-secondary)]"
                } ${isToday && !isSelected ? "ring-1 ring-[var(--ink-faint)]" : ""}`}
              >
                {day}
                {hasEvent && !isSelected && (
                  <span
                    className="absolute bottom-1 h-1 w-1 bg-accent"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="theme-ink-faint mt-3 flex flex-wrap items-center gap-4 border-t border-[var(--hairline)] px-1 pt-3 text-[10px] tracking-wider">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-accent" />
            有活动
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 ring-1 ring-[var(--ink-faint)]" />
            今天
          </span>
          <span className="ml-auto font-mono">{eventDayCount} DAYS</span>
        </div>
      </div>

      <div className="reveal-child ak-panel min-w-0 overflow-hidden min-[900px]:col-span-7 [--reveal-delay:180ms]">
        <div className="theme-hairline flex items-end justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div>
            <p className="theme-ink-faint text-[10px] tracking-[0.22em]">
              SELECTED DAY
            </p>
            <p className="theme-ink ak-date mt-1 text-sm font-semibold tracking-wide">
              {selectedKey
                ? formatAkDateFromCalendar(calFromKey(selectedKey))
                : "未选择日期"}
            </p>
          </div>
          <p className="theme-ink-faint font-mono text-[10px] tracking-wider">
            {dayProjects.length} EVENTS
          </p>
        </div>

        <div className="thin-scroll max-h-[22rem] overflow-y-auto">
          {!selectedKey ? (
            <p className="theme-ink-faint px-5 py-10 text-center text-sm">
              在日历中选择日期查看活动
            </p>
          ) : dayProjects.length === 0 ? (
            <p className="theme-ink-faint px-5 py-10 text-center text-sm">
              该日暂无监控活动
            </p>
          ) : (
            dayProjects.map((project, index) => {
              const projectTickets = ticketsByProject.get(project.id) ?? [];
              const available = projectTickets.filter((t) =>
                isAvailableStatus(t.status)
              ).length;

              return (
                <button
                  key={project.id}
                  type="button"
                  data-cursor="pointer"
                  onClick={() => openProject(project)}
                  style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
                  className="stagger-item theme-hairline flex min-h-14 w-full items-start gap-3 border-b px-3 py-3.5 text-left transition-colors last:border-b-0 hover:bg-accent/10 sm:min-h-0 sm:px-5"
                >
                  {project.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={project.cover}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-14 w-10 shrink-0 object-cover ring-1 ring-[var(--hairline)]"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-accent uppercase">
                        {project.type}
                      </span>
                      <span className="theme-ink-faint truncate font-mono text-[10px]">
                        #{project.id}
                      </span>
                    </div>
                    <p
                      className="theme-ink mt-1.5 line-clamp-2 text-sm font-medium break-all"
                      title={project.name || undefined}
                    >
                      {project.name || "未命名项目"}
                    </p>
                    <p className="theme-ink-faint mt-1 truncate text-xs">
                      {[project.project_label, project.venue_name]
                        .filter(Boolean)
                        .join(" · ") || "场地未知"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-[11px] text-accent tabular-nums">
                      {available}/{projectTickets.length || "—"}
                    </p>
                    <p className="theme-ink-faint mt-1 text-[10px] tracking-wider">
                      有票档
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
});

export function useEventDayCount(projects: Project[]): number {
  const sig = useMemo(() => calendarSignature(projects), [projects]);
  return useMemo(
    () => countEventDays(buildEventDateMap(projects)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sig]
  );
}
