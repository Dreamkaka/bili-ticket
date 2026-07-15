"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { Calendar } from "@heroui/react";
import {
  getLocalTimeZone,
  isToday,
  today,
  type CalendarDate,
  type DateValue,
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

function calendarSignature(projects: Project[]): string {
  return projects
    .map((p) => `${p.id}:${p.project_label ?? ""}`)
    .sort()
    .join("|");
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
  const eventKeys = useMemo(
    () => Array.from(eventMap.keys()).sort().join("|"),
    [eventMap]
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
  const tz = getLocalTimeZone();
  const todayDate = today(tz);

  const [value, setValue] = useState<CalendarDate | null>(() =>
    pickInitialFocus(eventMap, todayDate)
  );
  const [focusedValue, setFocusedValue] = useState<CalendarDate>(() =>
    pickInitialFocus(eventMap, todayDate)
  );
  const [seededKeys, setSeededKeys] = useState(eventKeys);

  useEffect(() => {
    if (eventKeys === seededKeys) return;
    const next = pickInitialFocus(eventMap, today(getLocalTimeZone()));
    setValue(next);
    setFocusedValue(next);
    setSeededKeys(eventKeys);
  }, [eventKeys, eventMap, seededKeys]);

  const selectedKey = value ? dateKey(value) : null;
  const dayProjects = selectedKey ? eventMap.get(selectedKey) ?? [] : [];

  const hasEvent = (date: CalendarDate) => eventMap.has(dateKey(date));

  const handleSelect = (next: DateValue | null) => {
    if (!next) {
      setValue(null);
      return;
    }
    const cal = next as CalendarDate;
    setValue(cal);
    setFocusedValue(cal);
  };

  const openProject = (project: Project) => {
    onSelectProject?.(project.id);
    scrollToId(`project-${project.id}`);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="reveal-child theme-panel min-w-0 border p-4 xl:col-span-5 [--reveal-delay:100ms]">
        <Calendar
          aria-label="活动日历"
          className="w-full max-w-none bg-transparent shadow-none"
          value={value}
          onChange={handleSelect}
          focusedValue={focusedValue}
          onFocusChange={setFocusedValue}
          weeksInMonth={6}
        >
          <Calendar.Header>
            <Calendar.Heading className="theme-ink text-sm font-semibold tracking-wide" />
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>
              {(day) => (
                <Calendar.HeaderCell className="theme-ink-faint text-[10px]">
                  {day}
                </Calendar.HeaderCell>
              )}
            </Calendar.GridHeader>
            <Calendar.GridBody>
              {(date) => (
                <Calendar.Cell date={date}>
                  {({ formattedDate }) => (
                    <>
                      {formattedDate}
                      {(hasEvent(date) || isToday(date, tz)) && (
                        <Calendar.CellIndicator
                          className={
                            hasEvent(date)
                              ? "bg-accent"
                              : "bg-[var(--ink-faint)]"
                          }
                        />
                      )}
                    </>
                  )}
                </Calendar.Cell>
              )}
            </Calendar.GridBody>
          </Calendar.Grid>
        </Calendar>

        <div className="theme-ink-faint mt-3 flex flex-wrap items-center gap-4 text-[10px] tracking-wider">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            有活动
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ink-faint)]" />
            今天
          </span>
          <span className="ml-auto font-mono">{eventDayCount} DAYS</span>
        </div>
      </div>

      <div className="reveal-child theme-panel min-w-0 border xl:col-span-7 [--reveal-delay:180ms]">
        <div className="theme-hairline flex items-end justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div>
            <p className="theme-ink-faint text-[10px] tracking-[0.22em]">
              SELECTED DAY
            </p>
            <p className="theme-ink ak-date mt-1 text-sm font-semibold tracking-wide">
              {value ? formatAkDateFromCalendar(value) : "未选择日期"}
            </p>
          </div>
          <p className="theme-ink-faint font-mono text-[10px] tracking-wider">
            {dayProjects.length} EVENTS
          </p>
        </div>

        <div className="max-h-[22rem] space-y-0 overflow-y-auto">
          {!value ? (
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
                  className="stagger-item theme-hairline flex w-full items-start gap-3 border-b px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-accent/10 sm:px-5"
                >
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
