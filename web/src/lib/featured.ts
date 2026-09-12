import {
  getLocalTimeZone,
  today,
  type CalendarDate,
} from "@internationalized/date";
import { parseProjectLabel, type ProjectDateRange } from "@/lib/project-date";
import type { Project } from "@/lib/types";

export type FeaturedPhase = "upcoming" | "ongoing" | "ended" | "unknown";

export type FeaturedInfo = {
  project: Project;
  range: ProjectDateRange | null;
  /** 开幕日 00:00（本地时区） */
  openingMs: number | null;
  /** 结束日 23:59:59（本地时区） */
  endingMs: number | null;
  phase: FeaturedPhase;
};

function calToStartMs(d: CalendarDate): number {
  return new Date(d.year, d.month - 1, d.day, 0, 0, 0, 0).getTime();
}

function calToEndMs(d: CalendarDate): number {
  return new Date(d.year, d.month - 1, d.day, 23, 59, 59, 999).getTime();
}

/** 优先 core；取最近即将开幕的项目，全已开幕则取进行中，兜底第一个 */
export function pickFeaturedProject(projects: Project[]): Project | null {
  if (projects.length === 0) return null;
  const cores = projects.filter((p) => p.type === "core");
  const pool = cores.length > 0 ? cores : projects;
  const now = today(getLocalTimeZone());

  const withRange = pool
    .map((p) => ({ p, r: parseProjectLabel(p.project_label) }))
    .filter((x): x is { p: Project; r: ProjectDateRange } => x.r != null);

  const upcoming = withRange
    .filter((x) => x.r.start.compare(now) >= 0)
    .sort((a, b) => a.r.start.compare(b.r.start));
  if (upcoming.length > 0) return upcoming[0].p;

  const ongoing = withRange
    .filter((x) => x.r.end.compare(now) >= 0)
    .sort((a, b) => a.r.end.compare(b.r.end));
  if (ongoing.length > 0) return ongoing[0].p;

  // 全已开幕/已闭幕时，优先取最新举办的项目（start 最晚）
  const byLatest = [...withRange].sort((a, b) => b.r.start.compare(a.r.start));
  if (byLatest.length > 0) return byLatest[0].p;

  return pool[0] ?? null;
}

export function getFeaturedInfo(project: Project | null): FeaturedInfo | null {
  if (!project) return null;
  const range = parseProjectLabel(project.project_label);
  const now = today(getLocalTimeZone());

  let phase: FeaturedPhase = "unknown";
  if (range) {
    if (range.start.compare(now) > 0) phase = "upcoming";
    else if (range.end.compare(now) >= 0) phase = "ongoing";
    else phase = "ended";
  }

  return {
    project,
    range,
    openingMs: range ? calToStartMs(range.start) : null,
    endingMs: range ? calToEndMs(range.end) : null,
    phase,
  };
}
