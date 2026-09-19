import { getLocalTimeZone, today } from "@internationalized/date";
import { parseProjectLabel } from "@/lib/project-date";

export const WEATHER_HORIZON_DAYS = 10;

export type WeatherDay = {
  date: string;
  weekday: string;
  textDay: string;
  textNight: string;
  tempMax: number | null;
  tempMin: number | null;
  precip: number | null;
  humidity: number | null;
  windDirDay: string | null;
  windScaleDay: string | null;
  iconDay: string | null;
};

export type WeatherAlert = {
  id: string;
  headline: string;
  description: string | null;
  eventName: string;
  severity: string;
  color: string | null;
  senderName: string | null;
  expireTime: string | null;
};

export type WeatherPayload = {
  days: WeatherDay[];
  mode: "event" | "recent";
  rangeLabel: string;
  attribution: string | null;
};

export type WeatherAlertPayload = {
  alerts: WeatherAlert[];
  attribution: string | null;
};

export type WeatherQuery = {
  days: number;
  start: string;
  end: string;
  mode: "event" | "recent";
  rangeLabel: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatRangeLabel(start: string, end: string): string {
  const [sy, sm, sd] = start.split("-");
  const [ey, em, ed] = end.split("-");
  if (start === end) return `${sy}.${sm}.${sd}`;
  if (sy === ey && sm === em) return `${sy}.${sm}.${sd}–${ed}`;
  if (sy === ey) return `${sy}.${sm}.${sd}–${em}.${ed}`;
  return `${sy}.${sm}.${sd}–${ey}.${em}.${ed}`;
}

/** 开展日在预报窗口内则查展期；否则回退最近几天。 */
export function resolveWeatherQuery(
  projectLabel: string | null | undefined,
  now = today(getLocalTimeZone())
): WeatherQuery {
  const todayDate = new Date(now.year, now.month - 1, now.day);
  const horizonEnd = addDays(todayDate, WEATHER_HORIZON_DAYS - 1);
  const range = parseProjectLabel(projectLabel);

  if (range) {
    const start = new Date(range.start.year, range.start.month - 1, range.start.day);
    const end = new Date(range.end.year, range.end.month - 1, range.end.day);
    const overlapStart = start > todayDate ? start : todayDate;
    const overlapEnd = end < horizonEnd ? end : horizonEnd;
    if (overlapStart.getTime() <= overlapEnd.getTime()) {
      const startStr = ymd(
        overlapStart.getFullYear(),
        overlapStart.getMonth() + 1,
        overlapStart.getDate()
      );
      const endStr = ymd(
        overlapEnd.getFullYear(),
        overlapEnd.getMonth() + 1,
        overlapEnd.getDate()
      );
      const days =
        Math.round(
          (overlapEnd.getTime() - overlapStart.getTime()) / 86_400_000
        ) + 1;
      return {
        days,
        start: startStr,
        end: endStr,
        mode: "event",
        rangeLabel: formatRangeLabel(startStr, endStr),
      };
    }
  }

  const recentDays = 7;
  const end = addDays(todayDate, recentDays - 1);
  const startStr = ymd(now.year, now.month, now.day);
  const endStr = ymd(end.getFullYear(), end.getMonth() + 1, end.getDate());
  return {
    days: recentDays,
    start: startStr,
    end: endStr,
    mode: "recent",
    rangeLabel: formatRangeLabel(startStr, endStr),
  };
}

export function weekdayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return ["日", "一", "二", "三", "四", "五", "六"][parsed.getDay()] ?? "";
}

export function weatherIconUrl(code: string | null | undefined): string | null {
  if (!code) return null;
  return `https://icons.qweather.com/assets/icons/${code}.svg`;
}

export function roundCoord(value: number): string {
  return value.toFixed(2);
}

export function alertTone(
  severity: string,
  color: string | null
): "danger" | "warning" | "accent" | "default" {
  const s = severity.toLowerCase();
  const c = (color || "").toLowerCase();
  if (s === "extreme" || s === "severe" || ["red", "purple", "black"].includes(c)) {
    return "danger";
  }
  if (s === "moderate" || ["orange", "amber", "yellow"].includes(c)) {
    return "warning";
  }
  if (s === "minor" || ["blue", "green"].includes(c)) return "accent";
  return "default";
}

export function severityLabel(severity: string): string {
  switch (severity.toLowerCase()) {
    case "extreme":
      return "特别严重";
    case "severe":
      return "严重";
    case "moderate":
      return "较重";
    case "minor":
      return "一般";
    default:
      return "未知";
  }
}

export function formatAlertTime(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}-${day} ${h}:${min}`;
}
