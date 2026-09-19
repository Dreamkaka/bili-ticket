import { NextRequest } from "next/server";
import {
  roundCoord,
  type WeatherAlert,
  type WeatherAlertPayload,
} from "@/lib/weather";

function hostUrl(host: string): string {
  const trimmed = host.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const alertMemo = new Map<string, { exp: number; body: WeatherAlertPayload }>();
const ALERT_TTL_MS = 10 * 60 * 1000;

type V1Alert = {
  id?: string;
  senderName?: string;
  headline?: string;
  description?: string;
  expireTime?: string;
  severity?: string;
  eventType?: { name?: string; code?: string };
  color?: { code?: string };
  messageType?: { code?: string };
};

type V7Warning = {
  id?: string;
  sender?: string;
  title?: string;
  text?: string;
  endTime?: string;
  severity?: string;
  typeName?: string;
  type?: string;
};

function mapV1(alerts: V1Alert[]): WeatherAlert[] {
  return alerts
    .filter((a) => a.messageType?.code !== "cancel")
    .map((a, i) => ({
      id: a.id || `v1-${i}`,
      headline: a.headline || a.eventType?.name || "天气预警",
      description: a.description || null,
      eventName: a.eventType?.name || "预警",
      severity: a.severity || "unknown",
      color: a.color?.code || null,
      senderName: a.senderName || null,
      expireTime: a.expireTime || null,
    }));
}

function mapV7(warnings: V7Warning[]): WeatherAlert[] {
  return warnings.map((w, i) => ({
    id: w.id || `v7-${i}`,
    headline: w.title || w.typeName || "天气预警",
    description: w.text || null,
    eventName: w.typeName || w.type || "预警",
    severity: (w.severity || "unknown").toLowerCase(),
    color: null,
    senderName: w.sender || null,
    expireTime: w.endTime || null,
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const latRaw = Number(searchParams.get("lat"));
  const lngRaw = Number(searchParams.get("lng"));

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

  const lat = roundCoord(latRaw);
  const lng = roundCoord(lngRaw);
  const memoKey = `${lat},${lng}`;
  const cached = alertMemo.get(memoKey);
  if (cached && cached.exp > Date.now()) {
    return Response.json(cached.body);
  }

  const headers = { "X-QW-Api-Key": key, Accept: "application/json" };
  const v1Url = `${hostUrl(host)}/weatheralert/v1/current/${lat}/${lng}?lang=zh`;

  try {
    const v1Res = await fetch(v1Url, { headers, cache: "no-store" });
    const v1Json = (await v1Res.json()) as {
      metadata?: { zeroResult?: boolean; attributions?: string[] };
      alerts?: V1Alert[];
      code?: string;
      warning?: V7Warning[];
    };

    if (v1Res.ok && Array.isArray(v1Json.alerts)) {
      const body: WeatherAlertPayload = {
        alerts: mapV1(v1Json.alerts),
        attribution:
          v1Json.metadata?.attributions?.[0] || "https://www.qweather.com",
      };
      alertMemo.set(memoKey, { exp: Date.now() + ALERT_TTL_MS, body });
      return Response.json(body);
    }

    const v7Url = `${hostUrl(host)}/v7/warning/now?location=${encodeURIComponent(
      `${lng},${lat}`
    )}&lang=zh`;
    const v7Res = await fetch(v7Url, { headers, cache: "no-store" });
    const v7Json = (await v7Res.json()) as {
      code?: string;
      warning?: V7Warning[];
    };
    if (!v7Res.ok || v7Json.code !== "200") {
      return Response.json(
        { error: `天气预警请求失败 (${v1Json.code || v1Res.status})` },
        { status: 502 }
      );
    }
    const body: WeatherAlertPayload = {
      alerts: mapV7(Array.isArray(v7Json.warning) ? v7Json.warning : []),
      attribution: "https://www.qweather.com",
    };
    alertMemo.set(memoKey, { exp: Date.now() + ALERT_TTL_MS, body });
    return Response.json(body);
  } catch (err) {
    console.error("qweather alert fetch failed:", err);
    return Response.json({ error: "天气预警网络错误" }, { status: 502 });
  }
}
