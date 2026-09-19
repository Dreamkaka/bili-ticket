import { NextRequest } from "next/server";
import {
  resolveWeatherQuery,
  roundCoord,
  weekdayLabel,
  type WeatherDay,
  type WeatherPayload,
} from "@/lib/weather";

type QWeatherDaily = {
  fxDate?: string;
  textDay?: string;
  textNight?: string;
  tempMax?: string;
  tempMin?: string;
  precip?: string;
  humidity?: string;
  windDirDay?: string;
  windScaleDay?: string;
  iconDay?: string;
};

function parseNumber(value: string | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hostUrl(host: string): string {
  const trimmed = host.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const weatherMemo = new Map<string, { exp: number; body: WeatherPayload }>();
const WEATHER_TTL_MS = 30 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const latRaw = Number(searchParams.get("lat"));
  const lngRaw = Number(searchParams.get("lng"));
  const label = searchParams.get("label");

  if (!Number.isFinite(latRaw) || !Number.isFinite(lngRaw)) {
    return Response.json({ error: "缺少有效经纬度" }, { status: 400 });
  }

  const host = process.env.QWEATHER_API_HOST?.trim();
  const key = process.env.QWEATHER_API_KEY?.trim();
  if (!host || !key) {
    return Response.json(
      { error: "未配置和风天气 QWEATHER_API_HOST / QWEATHER_API_KEY" },
      { status: 503 }
    );
  }

  const query = resolveWeatherQuery(label);
  const lat = roundCoord(latRaw);
  const lng = roundCoord(lngRaw);
  const memoKey = `${lat},${lng}|${query.start}|${query.end}|${query.mode}`;
  const cached = weatherMemo.get(memoKey);
  if (cached && cached.exp > Date.now()) {
    return Response.json(cached.body);
  }
  const url = `${hostUrl(host)}/v7/weather/10d?location=${encodeURIComponent(
    `${lng},${lat}`
  )}&lang=zh`;

  try {
    const res = await fetch(url, {
      headers: { "X-QW-Api-Key": key, Accept: "application/json" },
      next: { revalidate: 1800 },
    });
    const json = (await res.json()) as {
      code?: string;
      daily?: QWeatherDaily[];
      refer?: { sources?: string[] };
    };

    if (!res.ok || json.code !== "200" || !Array.isArray(json.daily)) {
      return Response.json(
        { error: `和风天气请求失败 (${json.code || res.status})` },
        { status: 502 }
      );
    }

    const mapped: WeatherDay[] = json.daily
      .filter((d): d is QWeatherDaily & { fxDate: string } => Boolean(d.fxDate))
      .map((d) => ({
        date: d.fxDate,
        weekday: weekdayLabel(d.fxDate),
        textDay: d.textDay || "—",
        textNight: d.textNight || "—",
        tempMax: parseNumber(d.tempMax),
        tempMin: parseNumber(d.tempMin),
        precip: parseNumber(d.precip),
        humidity: parseNumber(d.humidity),
        windDirDay: d.windDirDay || null,
        windScaleDay: d.windScaleDay || null,
        iconDay: d.iconDay || null,
      }));

    const inWindow = mapped.filter(
      (d) => d.date >= query.start && d.date <= query.end
    );
    const days = inWindow.length > 0 ? inWindow : mapped.slice(0, 7);
    const mode = inWindow.length > 0 ? query.mode : "recent";
    const rangeLabel =
      days.length > 0
        ? `${days[0].date}–${days[days.length - 1].date}`
        : query.rangeLabel;

    const payload: WeatherPayload = {
      days,
      mode,
      rangeLabel,
      attribution: json.refer?.sources?.[0] || "https://www.qweather.com",
    };
    weatherMemo.set(memoKey, { exp: Date.now() + WEATHER_TTL_MS, body: payload });
    return Response.json(payload);
  } catch (err) {
    console.error("qweather fetch failed:", err);
    return Response.json({ error: "和风天气网络错误" }, { status: 502 });
  }
}
