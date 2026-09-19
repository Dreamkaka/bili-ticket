export const FANSTUDIO_ORIGIN = "https://api.fanstudio.tech";

export type TyphoonPoint = {
  time: string;
  lng: number;
  lat: number;
  strong: string;
  power: string;
  speed: string | null;
  pressure: string | null;
  windRadii: { level: number; km: number[] }[];
};

export type TyphoonStorm = {
  tfid: string;
  name: string;
  enname: string;
  isactive: boolean;
  center: [number, number] | null;
  track: TyphoonPoint[];
  forecast: { agency: string; issuedTime: string; points: TyphoonPoint[] }[];
  ckposition: string | null;
  jl: string | null;
};

export type WindHeader = {
  parameterName: string;
  nx: number;
  ny: number;
  lo1: number;
  la1: number;
  lo2: number;
  la2: number;
  d: number;
  nodata: number;
  forecastTime?: string;
  refTime?: string;
};

export type WindComponent = {
  header: WindHeader;
  data: number[];
};

export type WindField = {
  u: WindComponent;
  v: WindComponent;
  forecastTime: string | null;
};

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string {
  return value == null ? "" : String(value);
}

function parsePoint(raw: Record<string, unknown>): TyphoonPoint | null {
  const lng = num(raw.lng);
  const lat = num(raw.lat);
  if (lng == null || lat == null || Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
  return {
    time: str(raw.time),
    lng,
    lat,
    strong: str(raw.strong) || "热带低压",
    power: str(raw.power),
    speed: raw.speed == null ? null : str(raw.speed),
    pressure: raw.pressure == null ? null : str(raw.pressure),
    windRadii: [7, 10, 12].flatMap((level) => {
      const value = raw[`radius${level}`];
      if (typeof value !== "string" || !value.trim()) return [];
      const parts = value.split("|").map((part) => part.trim() ? Number(part) : NaN);
      const km = parts.length === 1 ? Array(4).fill(parts[0]) as number[] : parts;
      if (km.length !== 4 || km.some((r) => !Number.isFinite(r) || r < 0) || !km.some((r) => r > 0)) return [];
      return [{ level, km }];
    }),
  };
}

export function parseTyphoonPayload(raw: unknown): TyphoonStorm[] {
  if (!Array.isArray(raw)) return [];
  const storms: TyphoonStorm[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const points = Array.isArray(obj.points) ? obj.points : [];
    const track: TyphoonPoint[] = [];
    for (const p of points) {
      if (!p || typeof p !== "object") continue;
      const parsed = parsePoint(p as Record<string, unknown>);
      if (parsed) track.push(parsed);
    }

    track.sort((a, b) => a.time.localeCompare(b.time));
    const lastTrack = track[track.length - 1];
    const byAgency = new Map<string, TyphoonStorm["forecast"][number]>();
    // 各机构发布时间可能不同，保留每个机构最近一次发布的预报。
    for (const p of [...points].sort((a, b) => str(a?.time).localeCompare(str(b?.time)))) {
      if (!p || !Array.isArray(p.forecast)) continue;
      for (const group of p.forecast) {
        if (!group || !Array.isArray(group.forecastpoints)) continue;
        const agency = str(group.tm) || "未知机构";
        const future = group.forecastpoints
          .filter((fp: unknown) => fp && typeof fp === "object")
          .map((fp: Record<string, unknown>) => parsePoint(fp))
          .filter((fp: TyphoonPoint | null): fp is TyphoonPoint =>
            fp !== null && !!fp.time && (!lastTrack || fp.time > lastTrack.time))
          .sort((a: TyphoonPoint, b: TyphoonPoint) => a.time.localeCompare(b.time));
        byAgency.set(agency, { agency, issuedTime: str(p.time), points: future });
      }
    }
    const forecast = [...byAgency.values()].filter((f) => f.points.length > 0);
    storms.push({
      tfid: str(obj.tfid),
      name: str(obj.name) || "未命名",
      enname: str(obj.enname),
      isactive: str(obj.isactive) === "1",
      center: lastTrack ? [lastTrack.lng, lastTrack.lat] : null,
      track,
      forecast,
      ckposition: obj.ckposition ? str(obj.ckposition) : null,
      jl: obj.jl ? str(obj.jl) : null,
    });
  }
  return storms;
}

function asComponent(raw: unknown): WindComponent | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const headerRaw = obj.header as Record<string, unknown> | undefined;
  const data = Array.isArray(obj.data) ? obj.data.map((n) => Number(n) || 0) : [];
  if (!headerRaw || data.length === 0) return null;
  const nx = num(headerRaw.nx);
  const ny = num(headerRaw.ny);
  const d = num(headerRaw.d);
  if (!nx || !ny || !d) return null;
  return {
    header: {
      parameterName: str(headerRaw.parameterName),
      nx,
      ny,
      lo1: num(headerRaw.lo1) ?? 0,
      la1: num(headerRaw.la1) ?? 90,
      lo2: num(headerRaw.lo2) ?? 359,
      la2: num(headerRaw.la2) ?? -90,
      d,
      nodata: num(headerRaw.nodata) ?? 0,
      forecastTime: headerRaw.forecastTime ? str(headerRaw.forecastTime) : undefined,
      refTime: headerRaw.refTime ? str(headerRaw.refTime) : undefined,
    },
    data,
  };
}

export function parseWindField(raw: unknown): WindField | null {
  if (!Array.isArray(raw)) return null;
  let u: WindComponent | null = null;
  let v: WindComponent | null = null;
  for (const item of raw) {
    const comp = asComponent(item);
    if (!comp) continue;
    const name = comp.header.parameterName.toUpperCase();
    if (name.includes("UGRD") || name.startsWith("U")) u = comp;
    else if (name.includes("VGRD") || name.startsWith("V")) v = comp;
  }
  if (!u || !v) return null;
  return {
    u,
    v,
    forecastTime: u.header.forecastTime ?? v.header.forecastTime ?? null,
  };
}

export function typhoonColor(strong: string): string {
  if (strong.includes("超强")) return "#c44cff";
  if (strong.includes("强台风")) return "#ff4d4d";
  if (strong.includes("台风") && !strong.includes("热带")) return "#ff8a3d";
  if (strong.includes("强热带风暴")) return "#ffd24d";
  if (strong.includes("热带风暴")) return "#3ddc7a";
  return "#4cc9ff";
}

function wrapLng(lng: number): number {
  let x = lng;
  while (x < 0) x += 360;
  while (x >= 360) x -= 360;
  return x;
}

function sampleGrid(comp: WindComponent, lng: number, lat: number): number | null {
  const { nx, ny, lo1, la1, d, nodata } = comp.header;
  const data = comp.data;
  const x = wrapLng(lng);
  const fx = (x - lo1) / d;
  const fy = (la1 - lat) / d;
  if (fx < 0 || fy < 0 || fx > nx - 1 || fy > ny - 1) return null;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, nx - 1);
  const y1 = Math.min(y0 + 1, ny - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const i00 = y0 * nx + x0;
  const i10 = y0 * nx + x1;
  const i01 = y1 * nx + x0;
  const i11 = y1 * nx + x1;
  const v00 = data[i00];
  const v10 = data[i10];
  const v01 = data[i01];
  const v11 = data[i11];
  if ([v00, v10, v01, v11].some((v) => v == null || v === nodata)) {
    const fallback = v00 ?? v10 ?? v01 ?? v11;
    return fallback == null || fallback === nodata ? null : fallback;
  }
  return (
    v00 * (1 - tx) * (1 - ty) +
    v10 * tx * (1 - ty) +
    v01 * (1 - tx) * ty +
    v11 * tx * ty
  );
}

export function sampleWind(
  field: WindField,
  lng: number,
  lat: number
): { u: number; v: number; speed: number } | null {
  const u = sampleGrid(field.u, lng, lat);
  const v = sampleGrid(field.v, lng, lat);
  if (u == null || v == null) return null;
  return { u, v, speed: Math.hypot(u, v) };
}
