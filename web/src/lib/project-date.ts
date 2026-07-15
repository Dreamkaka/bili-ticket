import { CalendarDate } from "@internationalized/date";
import type { Project } from "@/lib/types";

export type DateParts = { year: number; month: number; day: number };

export type ProjectDateRange = {
  start: CalendarDate;
  end: CalendarDate;
  raw: string;
};

function stripLabel(label: string): string {
  return label
    .replace(/（[^）]*）/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/以现场为准/g, " ")
    .trim();
}

function toCal(y: number, m: number, d: number): CalendarDate | null {
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  try {
    return new CalendarDate(y, m, d);
  } catch {
    return null;
  }
}

function parseYmd(y: string, m: string, d: string): CalendarDate | null {
  return toCal(Number(y), Number(m), Number(d));
}

/**
 * 解析 B 站 project_label，例如：
 * - 2026.07.17-07.20（以现场为准）
 * - 2026.07.31-08.03（以现场为准）
 * - 2026.08.08（以现场为准）
 */
export function parseProjectLabel(label: string | null | undefined): ProjectDateRange | null {
  if (!label) return null;
  const text = stripLabel(label);
  if (!text) return null;

  // 跨年：YYYY.MM.DD - YYYY.MM.DD
  {
    const m = text.match(
      /(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*[-~—至到]\s*(\d{4})[./-](\d{1,2})[./-](\d{1,2})/
    );
    if (m) {
      const start = parseYmd(m[1], m[2], m[3]);
      const end = parseYmd(m[4], m[5], m[6]);
      if (start && end) {
        return start.compare(end) <= 0
          ? { start, end, raw: label }
          : { start: end, end: start, raw: label };
      }
    }
  }

  // 同月区间：YYYY.MM.DD-DD
  {
    const m = text.match(
      /(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*[-~—至到]\s*(\d{1,2})(?!\d|[./-])/
    );
    if (m) {
      const start = parseYmd(m[1], m[2], m[3]);
      const end = parseYmd(m[1], m[2], m[4]);
      if (start && end) {
        return start.compare(end) <= 0
          ? { start, end, raw: label }
          : { start: end, end: start, raw: label };
      }
    }
  }

  // 同年跨月：YYYY.MM.DD-MM.DD
  {
    const m = text.match(
      /(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*[-~—至到]\s*(\d{1,2})[./-](\d{1,2})/
    );
    if (m) {
      const start = parseYmd(m[1], m[2], m[3]);
      const end = parseYmd(m[1], m[4], m[5]);
      if (start && end) {
        return start.compare(end) <= 0
          ? { start, end, raw: label }
          : { start: end, end: start, raw: label };
      }
    }
  }

  // 单日：YYYY.MM.DD
  {
    const m = text.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (m) {
      const day = parseYmd(m[1], m[2], m[3]);
      if (day) return { start: day, end: day, raw: label };
    }
  }

  return null;
}

export function dateKey(date: CalendarDate): string {
  return date.toString();
}

export function expandRange(start: CalendarDate, end: CalendarDate): CalendarDate[] {
  const days: CalendarDate[] = [];
  let cur = start;
  // 安全上限：单项目最多展开 120 天
  for (let i = 0; i < 120; i++) {
    days.push(cur);
    if (cur.compare(end) >= 0) break;
    cur = cur.add({ days: 1 });
  }
  return days;
}

export function buildEventDateMap(projects: Project[]): Map<string, Project[]> {
  const map = new Map<string, Project[]>();

  for (const project of projects) {
    const range = parseProjectLabel(project.project_label);
    if (!range) continue;
    for (const day of expandRange(range.start, range.end)) {
      const key = dateKey(day);
      const list = map.get(key);
      if (list) {
        if (!list.some((p) => p.id === project.id)) list.push(project);
      } else {
        map.set(key, [project]);
      }
    }
  }

  return map;
}

export function countEventDays(map: Map<string, Project[]>): number {
  return map.size;
}

export function formatAkDateFromCalendar(date: CalendarDate): string {
  const y = date.year;
  const m = String(date.month).padStart(2, "0");
  const d = String(date.day).padStart(2, "0");
  return `${y} // ${m} / ${d}`;
}

/** 优先今天；若当月无活动则跳到最近有活动的日期所在月 */
export function pickInitialFocus(
  map: Map<string, Project[]>,
  todayDate: CalendarDate
): CalendarDate {
  if (map.has(dateKey(todayDate))) return todayDate;

  const keys = Array.from(map.keys()).sort();
  if (keys.length === 0) return todayDate;

  const todayStr = dateKey(todayDate);
  const upcoming = keys.find((k) => k >= todayStr);
  const pick = upcoming ?? keys[keys.length - 1];
  const [y, m, d] = pick.split("-").map(Number);
  return new CalendarDate(y, m, d);
}
