"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import {
  geocodeVenue,
  getAmapKey,
  loadAMap,
  type AMapIndoorMap,
  type AMapInstance,
  type AMapLayer,
  type AMapMarker,
  type AMapNamespace,
} from "@/lib/amap";
import type { Project } from "@/lib/types";
import type { WeatherAlert, WeatherPayload } from "@/lib/weather";
import type { TyphoonStorm, WindField } from "@/lib/fanstudio";
import { WeatherCard } from "./WeatherCard";
import { WindParticles } from "./WindParticles";
import { clearTyphoons, drawTyphoons, type TyphoonHandle } from "./typhoon-layer";

type GeoHit = {
  lng: number;
  lat: number;
  formatted: string;
};

type MarkerEntry = {
  project: Project;
  geo: GeoHit;
  marker: AMapMarker;
};

function venueQuery(project: Project): string | null {
  const name = project.venue_name?.trim();
  return name || null;
}

async function fetchWeather(
  geo: GeoHit,
  label: string | null
): Promise<WeatherPayload> {
  const params = new URLSearchParams({
    lat: String(geo.lat),
    lng: String(geo.lng),
  });
  if (label) params.set("label", label);
  const res = await fetch(`/api/weather?${params.toString()}`, {
    cache: "no-store",
  });
  const json = (await res.json()) as WeatherPayload & { error?: string };
  if (!res.ok) throw new Error(json.error || `天气请求失败 ${res.status}`);
  return json;
}

async function fetchWeatherAlerts(geo: GeoHit): Promise<WeatherAlert[]> {
  const params = new URLSearchParams({
    lat: String(geo.lat),
    lng: String(geo.lng),
  });
  const res = await fetch(`/api/weather-alert?${params.toString()}`, {
    cache: "no-store",
  });
  const json = (await res.json()) as { alerts?: WeatherAlert[]; error?: string };
  if (!res.ok) throw new Error(json.error || `预警请求失败 ${res.status}`);
  return json.alerts ?? [];
}

export function ExhibitionMap({ projects }: { projects: Project[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMapInstance | null>(null);
  const AMapRef = useRef<AMapNamespace | null>(null);
  const markersRef = useRef<MarkerEntry[]>([]);
  const satelliteRef = useRef<AMapLayer | null>(null);
  const roadNetRef = useRef<AMapLayer | null>(null);
  const trafficRef = useRef<AMapLayer | null>(null);
  const typhoonRef = useRef<TyphoonHandle | null>(null);
  const indoorRef = useRef<AMapIndoorMap | null>(null);
  const indoorSigRef = useRef("");
  const controlBarRef = useRef<unknown>(null);
  const controlAddedRef = useRef(false);
  const weatherCache = useRef(new Map<string, WeatherPayload>());
  const alertCache = useRef(new Map<string, WeatherAlert[]>());

  const { resolvedTheme } = useTheme();
  const themeRef = useRef(resolvedTheme);
  themeRef.current = resolvedTheme;
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "done">(
    "idle"
  );
  const [located, setLocated] = useState<
    Array<{ project: Project; geo: GeoHit }>
  >([]);
  const [failed, setFailed] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [satelliteOn, setSatelliteOn] = useState(false);
  const [trafficOn, setTrafficOn] = useState(false);
  const [typhoonOn, setTyphoonOn] = useState(true);
  const [windOn, setWindOn] = useState(false);
  const [typhoons, setTyphoons] = useState<TyphoonStorm[]>([]);
  const [typhoonMsg, setTyphoonMsg] = useState<string | null>(null);
  const [typhoonLoading, setTyphoonLoading] = useState(false);
  const [windField, setWindField] = useState<WindField | null>(null);
  const [windLoading, setWindLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view3d, setView3d] = useState(false);
  const [indoor, setIndoor] = useState<{
    name: string;
    floors: Array<{ index: number; label: string }>;
    current: number;
  } | null>(null);

  const keyedProjects = useMemo(
    () =>
      projects.filter((p) => venueQuery(p)).map((p) => ({
        id: p.id,
        venue: venueQuery(p) as string,
        project: p,
      })),
    [projects]
  );
  const projectKey = keyedProjects.map((p) => `${p.id}:${p.venue}`).join("|");
  const selected = located.find((item) => item.project.id === selectedId) ?? null;

  const openWeather = useCallback(async (project: Project, geo: GeoHit) => {
    setSelectedId(project.id);
    setWeatherError(null);
    const cacheKey = `${geo.lng.toFixed(2)},${geo.lat.toFixed(2)}|${project.project_label ?? ""}`;
    const alertKey = `${geo.lng.toFixed(2)},${geo.lat.toFixed(2)}`;
    const cached = weatherCache.current.get(cacheKey);
    const cachedAlerts = alertCache.current.get(alertKey);
    if (cached && cachedAlerts) {
      setWeather(cached);
      setAlerts(cachedAlerts);
      setWeatherLoading(false);
      return;
    }
    if (!cached) setWeather(null);
    if (!cachedAlerts) setAlerts([]);
    setWeatherLoading(true);
    try {
      const [payload, nextAlerts] = await Promise.all([
        cached
          ? Promise.resolve(cached)
          : fetchWeather(geo, project.project_label),
        cachedAlerts
          ? Promise.resolve(cachedAlerts)
          : fetchWeatherAlerts(geo).catch(() => [] as WeatherAlert[]),
      ]);
      weatherCache.current.set(cacheKey, payload);
      alertCache.current.set(alertKey, nextAlerts);
      setWeather(payload);
      setAlerts(nextAlerts);
    } catch (err) {
      setWeatherError(err instanceof Error ? err.message : "天气请求失败");
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let created: AMapInstance | null = null;
    if (!getAmapKey()) {
      setMapError("未配置 NEXT_PUBLIC_AMAP_KEY");
      return;
    }

    loadAMap()
      .then((AMap) => {
        const el = containerRef.current;
        if (cancelled || !el) return;
        AMapRef.current = AMap;
        const indoorMap = AMap.IndoorMap
          ? new AMap.IndoorMap({ alwaysShow: true })
          : null;
        indoorRef.current = indoorMap;
        const layers =
          indoorMap && AMap.createDefaultLayer
            ? [indoorMap, AMap.createDefaultLayer()]
            : undefined;
        created = new AMap.Map(el, {
          viewMode: "3D",
          pitch: 0,
          rotation: 0,
          rotateEnable: true,
          pitchEnable: true,
          zoom: 5,
          center: [104.195397, 35.86166],
          showIndoorMap: !indoorMap,
          showBuildingBlock: true,
          layers,
          mapStyle:
            themeRef.current === "light"
              ? "amap://styles/whitesmoke"
              : "amap://styles/dark",
        });
        mapRef.current = created;
        indoorMap?.hideFloorBar?.();
        satelliteRef.current = new AMap.TileLayer.Satellite();
        roadNetRef.current = new AMap.TileLayer.RoadNet();
        trafficRef.current = new AMap.TileLayer.Traffic({
          autoRefresh: true,
          interval: 180,
        });
        created.add([
          satelliteRef.current,
          roadNetRef.current,
          trafficRef.current,
        ]);
        satelliteRef.current.hide?.();
        roadNetRef.current.hide?.();
        trafficRef.current.hide?.();

        const syncIndoor = () => {
          const b =
            indoorRef.current?.getSelectedBuilding?.() ??
            created?.indoorMap?.getSelectedBuilding?.();
          if (!b || !b.floor_details) {
            if (indoorSigRef.current !== "") {
              indoorSigRef.current = "";
              setIndoor(null);
            }
            return;
          }
          const labels = b.floor_details.floor_nonas ?? [];
          const indexes = b.floor_details.floor_indexs ?? [];
          const sig = `${b.id ?? ""}:${b.floor ?? ""}:${indexes.join(",")}`;
          if (sig === indoorSigRef.current) return;
          indoorSigRef.current = sig;
          const floors = indexes.map((index, i) => ({
            index,
            label: labels[i] || String(index),
          }));
          setIndoor({
            name: b.name || "室内地图",
            floors,
            current: b.floor ?? indexes[0] ?? 1,
          });
        };
        created.on?.("indoor_create", () => {
          indoorRef.current = created?.indoorMap ?? indoorRef.current;
          indoorRef.current?.hideFloorBar?.();
          syncIndoor();
        });
        created.on?.("zoomchange", syncIndoor);
        created.on?.("mapmove", syncIndoor);

        if (AMap.ControlBar) {
          controlBarRef.current = new AMap.ControlBar({
            position: { right: "12px", top: "12px" },
            showZoomBar: false,
            showControlButton: true,
          });
        }
        requestAnimationFrame(() => created?.resize?.());
        setMapReady(true);
        setMapError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setMapError(err instanceof Error ? err.message : "高德地图加载失败");
        }
      });

    return () => {
      cancelled = true;
      if (created) clearTyphoons(created, typhoonRef.current);
      typhoonRef.current = null;
      created?.destroy();
      if (mapRef.current === created) mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.setMapStyle) return;
    map.setMapStyle(
      resolvedTheme === "light"
        ? "amap://styles/whitesmoke"
        : "amap://styles/dark"
    );
  }, [resolvedTheme, mapReady]);

  useEffect(() => {
    const AMap = AMapRef.current;
    const map = mapRef.current;
    if (!mapReady || !AMap || !map) return;

    if (!typhoonOn) {
      clearTyphoons(map, typhoonRef.current);
      typhoonRef.current = null;
      return;
    }

    let cancelled = false;
    setTyphoonLoading(true);
    fetch("/api/typhoon", { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as {
          storms?: TyphoonStorm[];
          message?: string | null;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "台风数据失败");
        if (cancelled) return;
        setTyphoons(json.storms || []);
        setTyphoonMsg(json.message || null);
        clearTyphoons(map, typhoonRef.current);
        typhoonRef.current = drawTyphoons(AMap, map, json.storms || []);
      })
      .catch(() => {
        if (!cancelled) setTyphoonMsg("台风数据加载失败");
      })
      .finally(() => {
        if (!cancelled) setTyphoonLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mapReady, typhoonOn]);

  useEffect(() => {
    if (!windOn) return;
    if (windField) return;
    let cancelled = false;
    setWindLoading(true);
    fetch("/api/wind-field", { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as { field?: WindField; error?: string };
        if (!res.ok || !json.field) throw new Error(json.error || "风场数据失败");
        if (!cancelled) setWindField(json.field);
      })
      .catch(() => {
        if (!cancelled) setWindField(null);
      })
      .finally(() => {
        if (!cancelled) setWindLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [windOn, windField]);

  useEffect(() => {
    const AMap = AMapRef.current;
    const map = mapRef.current;
    if (!mapReady || !AMap || !map) return;

    let cancelled = false;
    setGeoStatus("loading");
    setFailed([]);
    setLocated([]);

    for (const entry of markersRef.current) {
      map.remove(entry.marker);
    }
    markersRef.current = [];
    const uniqueVenues = Array.from(
      new Map(keyedProjects.map((p) => [p.venue, p.venue])).values()
    );

    (async () => {
      const geoByVenue = new Map<string, GeoHit | null>();
      for (const venue of uniqueVenues) {
        if (cancelled) return;
        const hit = await geocodeVenue(AMap, venue);
        geoByVenue.set(venue, hit);
      }
      if (cancelled) return;

      const hits: Array<{ project: Project; geo: GeoHit }> = [];
      const misses: Project[] = [];
      const markers: MarkerEntry[] = [];

      for (const item of keyedProjects) {
        const geo = geoByVenue.get(item.venue) ?? null;
        if (!geo) {
          misses.push(item.project);
          continue;
        }
        hits.push({ project: item.project, geo });
        const marker = new AMap.Marker({
          position: [geo.lng, geo.lat],
          title: item.project.name || item.venue,
        });
        marker.on("click", () => {
          void openWeather(item.project, geo);
          map.setCenter([geo.lng, geo.lat]);
        });
        markers.push({ project: item.project, geo, marker });
      }

      if (markers.length > 0) {
        map.add(markers.map((m) => m.marker));
        map.setFitView(
          markers.map((m) => m.marker),
          false,
          [60, 60, 60, 60],
          12
        );
      }
      markersRef.current = markers;
      setLocated(hits);
      setFailed(misses);
      setGeoStatus("done");
    })();

    return () => {
      cancelled = true;
    };
    // keyedProjects 随 snapshot 换引用；只按 id+venue 签名重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, projectKey, openWeather]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const id = window.setTimeout(() => map.resize?.(), 220);
    return () => window.clearTimeout(id);
  }, [sidebarOpen, mapReady]);

  const noVenue = projects.filter((p) => !venueQuery(p));

  return (
    <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
      <div
        className={`relative w-full shrink-0 lg:min-h-0 lg:flex-1 ${
          sidebarOpen
            ? "h-[min(46vh,420px)] lg:h-auto"
            : "h-[min(72vh,640px)] lg:h-auto"
        }`}
      >
        <div
          ref={containerRef}
          className="amap-container absolute inset-0 h-full w-full"
        />
        <WindParticles map={mapRef.current} field={windField} enabled={windOn} />
        {!mapReady && !mapError ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--background)]/70">
            <span className="inline-flex items-center gap-2 text-sm text-[var(--ink-faint)]">
              <Spinner size={16} />
              加载高德地图…
            </span>
          </div>
        ) : null}
        {mapError ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--background)]/80 px-6 text-center text-sm text-danger">
            {mapError}
          </div>
        ) : null}
        {mapReady ? (
          <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5">
            {geoStatus === "loading" ? (
              <span className="inline-flex items-center gap-2 border border-[var(--hairline)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-[11px] text-[var(--ink-soft)]">
                <Spinner size={12} />
                地理编码场馆…
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const next = !satelliteOn;
                setSatelliteOn(next);
                if (next) {
                  satelliteRef.current?.show?.();
                  roadNetRef.current?.show?.();
                } else {
                  satelliteRef.current?.hide?.();
                  roadNetRef.current?.hide?.();
                }
              }}
              className={`border px-2.5 py-1.5 font-mono text-[10px] tracking-wider uppercase ${
                satelliteOn
                  ? "border-accent/50 bg-accent text-accent-foreground"
                  : "border-[var(--hairline)] bg-[var(--panel-strong)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              卫星
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !trafficOn;
                setTrafficOn(next);
                if (next) trafficRef.current?.show?.();
                else trafficRef.current?.hide?.();
              }}
              className={`border px-2.5 py-1.5 font-mono text-[10px] tracking-wider uppercase ${
                trafficOn
                  ? "border-accent/50 bg-accent text-accent-foreground"
                  : "border-[var(--hairline)] bg-[var(--panel-strong)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              路况
            </button>
            <button
              type="button"
              onClick={() => setTyphoonOn((v) => !v)}
              className={`border px-2.5 py-1.5 font-mono text-[10px] tracking-wider uppercase ${
                typhoonOn
                  ? "border-accent/50 bg-accent text-accent-foreground"
                  : "border-[var(--hairline)] bg-[var(--panel-strong)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              {typhoonLoading ? "台风…" : "台风"}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !view3d;
                setView3d(next);
                const map = mapRef.current;
                if (!map) return;
                map.setPitch?.(next ? 50 : 0);
                if (next) {
                  if (controlBarRef.current && !controlAddedRef.current) {
                    map.addControl?.(controlBarRef.current);
                    controlAddedRef.current = true;
                  }
                } else {
                  if (controlBarRef.current && controlAddedRef.current) {
                    map.removeControl?.(controlBarRef.current);
                    controlAddedRef.current = false;
                  }
                  map.setRotation?.(0);
                }
              }}
              className={`border px-2.5 py-1.5 font-mono text-[10px] tracking-wider uppercase ${
                view3d
                  ? "border-accent/50 bg-accent text-accent-foreground"
                  : "border-[var(--hairline)] bg-[var(--panel-strong)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              3D
            </button>
            <button
              type="button"
              onClick={() => setWindOn((v) => !v)}
              className={`border px-2.5 py-1.5 font-mono text-[10px] tracking-wider uppercase ${
                windOn
                  ? "border-accent/50 bg-accent text-accent-foreground"
                  : "border-[var(--hairline)] bg-[var(--panel-strong)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              {windLoading ? "风场…" : "风场"}
            </button>
          </div>
        ) : null}
        {indoor && indoor.floors.length > 0 ? (
          <div className="absolute top-24 right-3 z-10 flex max-h-[50vh] flex-col border border-[var(--hairline)] bg-[var(--panel-strong)]">
            <p className="max-w-[88px] truncate px-2 py-1.5 font-mono text-[9px] tracking-wider text-[var(--ink-faint)] uppercase">
              {indoor.name}
            </p>
            <div className="thin-scroll max-h-[40vh] overflow-y-auto">
              {indoor.floors
                .slice()
                .reverse()
                .map((floor) => {
                  const active = floor.index === indoor.current;
                  return (
                    <button
                      key={`${floor.index}-${floor.label}`}
                      type="button"
                      onClick={() => {
                        indoorRef.current?.showFloor?.(floor.index);
                        mapRef.current?.indoorMap?.showFloor?.(floor.index);
                        setIndoor((prev) =>
                          prev ? { ...prev, current: floor.index } : prev
                        );
                      }}
                      className={`block w-full px-2.5 py-1.5 font-mono text-[11px] tracking-wider ${
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {floor.label}
                    </button>
                  );
                })}
            </div>
          </div>
        ) : null}
        {typhoonOn && (typhoons.length > 0 || typhoonMsg) ? (
          <div className="absolute top-12 left-3 z-10 max-w-[260px] border border-[var(--hairline)] bg-[var(--panel-strong)] px-2.5 py-2 text-[11px] text-[var(--ink-soft)]">
            {typhoons.length === 0 ? (
              <p>{typhoonMsg || "当前无台风"}</p>
            ) : (
              typhoons.map((s) => (
                <p key={s.tfid} className="truncate">
                  {s.name}
                  {s.enname ? ` / ${s.enname}` : ""} ·{" "}
                  {s.track[s.track.length - 1]?.strong || "路径"}
                </p>
              ))
            )}
          </div>
        ) : null}
        {selected ? (
          <div className="pointer-events-auto absolute right-3 bottom-3 left-3 z-10 max-w-md lg:left-3 lg:right-auto">
            <div className="ak-panel-strong border border-[var(--hairline)] px-3 py-2.5 shadow-lg">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">
                    {selected.project.name || selected.project.id}
                  </p>
                  <p className="truncate text-[11px] text-[var(--ink-faint)]">
                    {[selected.project.venue_name, selected.project.project_label]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 px-1 font-mono text-[10px] text-[var(--ink-faint)] hover:text-[var(--ink)]"
                  onClick={() => {
                    setSelectedId(null);
                    setWeather(null);
                    setAlerts([]);
                    setWeatherError(null);
                  }}
                >
                  CLOSE
                </button>
              </div>
              <WeatherCard
                payload={weather}
                alerts={alerts}
                loading={weatherLoading}
                error={weatherError}
              />
            </div>
          </div>
        ) : null}
      </div>

      {!sidebarOpen ? (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="flex h-10 w-full shrink-0 items-center justify-center gap-2 border-t border-[var(--hairline)] bg-[var(--background)] font-mono text-[10px] tracking-wider text-[var(--ink-soft)] uppercase hover:text-[var(--ink)] lg:h-full lg:w-10 lg:flex-col lg:border-t-0 lg:border-l"
          aria-label="展开展会列表"
        >
          <span className="lg:hidden">展开展会列表</span>
          <span className="hidden [writing-mode:vertical-rl] lg:inline">
            展会列表
          </span>
        </button>
      ) : (
      <aside className="flex h-[42vh] w-full shrink-0 flex-col border-t border-[var(--hairline)] bg-[var(--background)] lg:h-full lg:w-[380px] lg:border-t-0 lg:border-l">
        <div className="border-b border-[var(--hairline)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-block size-1.5 bg-accent" />
            <span className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">
              MAP · WEATHER
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="ml-auto px-1 font-mono text-[10px] tracking-wider text-[var(--ink-faint)] uppercase hover:text-[var(--ink)]"
              aria-label="收起展会列表"
            >
              收起
            </button>
          </div>
          <h2 className="mt-1 text-base font-semibold text-[var(--ink)]">
            {selected?.project.name || "选择场馆标记"}
          </h2>
          <p className="mt-0.5 truncate text-xs text-[var(--ink-faint)]">
            {selected
              ? [selected.project.venue_name, selected.project.project_label]
                  .filter(Boolean)
                  .join(" · ")
              : `已定位 ${located.length} / ${projects.length} 个展会`}
          </p>
        </div>

        <div className="border-b border-[var(--hairline)] px-4 py-3">
          <p className="text-xs text-[var(--ink-faint)]">
            点击地图标记或右侧列表，在标记点上查看展期天气预报。展期超出和风 10
            天窗口时显示最近几天。
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain thin-scroll px-3 py-3 [-webkit-overflow-scrolling:touch]">
          {located.length === 0 && geoStatus === "done" ? (
            <p className="px-1 py-6 text-center text-xs text-[var(--ink-faint)]">
              没有可定位的场馆
            </p>
          ) : (
            <ul className="space-y-1.5">
              {located.map((item) => {
                const active = item.project.id === selectedId;
                return (
                  <li key={item.project.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const map = mapRef.current;
                        map?.setZoom(13);
                        map?.setCenter([item.geo.lng, item.geo.lat]);
                        void openWeather(item.project, item.geo);
                      }}
                      className={`ak-panel flex w-full items-start gap-2 px-3 py-2.5 text-left ${
                        active ? "border-accent/50" : ""
                      }`}
                    >
                      {item.project.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.project.cover}
                          alt=""
                          width={36}
                          height={48}
                          className="h-12 w-9 shrink-0 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-medium text-[var(--ink)]">
                          {item.project.name || item.project.id}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-[var(--ink-faint)]">
                          {item.project.venue_name}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {failed.length > 0 || noVenue.length > 0 ? (
            <div className="mt-4 space-y-2 px-1">
              {failed.map((p) => (
                <p key={p.id} className="text-[11px] text-[var(--ink-faint)]">
                  <Badge tone="warning">未定位</Badge>{" "}
                  {p.name || p.id} · {p.venue_name}
                </p>
              ))}
              {noVenue.map((p) => (
                <p key={p.id} className="text-[11px] text-[var(--ink-faint)]">
                  <Badge>无场馆</Badge> {p.name || p.id}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </aside>
      )}
    </div>
  );
}


