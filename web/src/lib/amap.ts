export type AMapLngLat = {
  getLng: () => number;
  getLat: () => number;
};

export type AMapGeocode = {
  location?: AMapLngLat;
  formattedAddress?: string;
};

export type AMapLayer = {
  show?: () => void;
  hide?: () => void;
  setMap?: (map: AMapInstance | null) => void;
};

export type AMapPixel = { x: number; y: number; getX?: () => number; getY?: () => number };

export type AMapBounds = {
  getSouthWest: () => AMapLngLat;
  getNorthEast: () => AMapLngLat;
};

export type AMapInstance = {
  add: (overlay: unknown) => void;
  remove: (overlay: unknown) => void;
  setFitView: (
    overlays?: unknown[],
    immediately?: boolean,
    avoid?: [number, number, number, number],
    maxZoom?: number
  ) => void;
  setCenter: (lnglat: [number, number]) => void;
  setZoom: (zoom: number) => void;
  getZoom?: () => number;
  getBounds?: () => AMapBounds;
  getSize?: () => { getWidth: () => number; getHeight: () => number };
  lngLatToContainer?: (lnglat: [number, number] | AMapLngLat) => AMapPixel;
  containerToLngLat?: (pixel: [number, number] | AMapPixel) => AMapLngLat;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
  destroy: () => void;
  resize?: () => void;
  setMapStyle?: (style: string) => void;
  setPitch?: (pitch: number, immediate?: boolean) => void;
  getPitch?: () => number;
  setRotation?: (rotation: number, immediate?: boolean) => void;
  addControl?: (control: unknown) => void;
  removeControl?: (control: unknown) => void;
  indoorMap?: AMapIndoorMap;
};

export type AMapIndoorMap = {
  showIndoorMap?: (id: string, floor?: number, shopId?: string) => void;
  showFloor?: (floor: number) => void;
  hideFloorBar?: () => void;
  showFloorBar?: () => void;
  getSelectedBuilding?: () => {
    id?: string;
    name?: string;
    floor?: number;
    floor_details?: { floor_nonas?: string[]; floor_indexs?: number[] };
  } | null;
};

export type AMapMarker = {
  on: (event: string, handler: () => void) => void;
  getPosition: () => AMapLngLat;
  setMap: (map: AMapInstance | null) => void;
};

export type AMapNamespace = {
  Map: new (
    container: string | HTMLElement,
    opts?: Record<string, unknown>
  ) => AMapInstance;
  Marker: new (opts: Record<string, unknown>) => AMapMarker;
  Polyline: new (opts: Record<string, unknown>) => AMapLayer;
  Polygon: new (opts: Record<string, unknown>) => AMapLayer;
  CircleMarker: new (opts: Record<string, unknown>) => AMapLayer;
  TileLayer: {
    Satellite: new (opts?: Record<string, unknown>) => AMapLayer;
    RoadNet: new (opts?: Record<string, unknown>) => AMapLayer;
    Traffic: new (opts?: Record<string, unknown>) => AMapLayer;
  };
  IndoorMap: new (opts?: Record<string, unknown>) => AMapIndoorMap & AMapLayer;
  Buildings: new (opts?: Record<string, unknown>) => AMapLayer;
  ControlBar: new (opts?: Record<string, unknown>) => unknown;
  ToolBar: new (opts?: Record<string, unknown>) => unknown;
  createDefaultLayer?: (opts?: Record<string, unknown>) => AMapLayer;
  Pixel: new (x: number, y: number) => unknown;
  Size: new (w: number, h: number) => unknown;
  plugin: (
    name: string | string[],
    cb: () => void
  ) => void;
  Geocoder: new (opts?: Record<string, unknown>) => {
    getLocation: (
      address: string,
      cb: (status: string, result: { info?: string; geocodes?: AMapGeocode[] }) => void
    ) => void;
  };
};

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode?: string };
  }
}

let loadPromise: Promise<AMapNamespace> | null = null;

export function getAmapKey(): string {
  return (process.env.NEXT_PUBLIC_AMAP_KEY || "").trim();
}

export function getAmapSecurityCode(): string {
  return (process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE || "").trim();
}

function applySecurityConfig() {
  const security = getAmapSecurityCode();
  if (security) {
    window._AMapSecurityConfig = { securityJsCode: security };
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`
    );
    if (existing) {
      if ((window as unknown as { AMap?: AMapNamespace }).AMap) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("高德 JS API 脚本加载失败")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("高德 JS API 脚本加载失败"));
    document.head.appendChild(script);
  });
}

export function loadAMap(): Promise<AMapNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("高德 JS API 仅可在浏览器中加载"));
  }
  if (loadPromise) return loadPromise;
  const key = getAmapKey();
  if (!key) {
    return Promise.reject(new Error("未配置 NEXT_PUBLIC_AMAP_KEY"));
  }

  applySecurityConfig();

  loadPromise = (async () => {
    const existing = (window as unknown as { AMap?: AMapNamespace }).AMap;
    if (existing?.Map) return existing;

    const src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(
      key
    )}&plugin=AMap.Geocoder,AMap.IndoorMap,AMap.ControlBar,AMap.ToolBar,AMap.Scale`;
    await loadScript(src);
    const AMap = (window as unknown as { AMap?: AMapNamespace }).AMap;
    if (!AMap?.Map) throw new Error("高德 JS API 未就绪");
    return AMap;
  })();

  loadPromise.catch(() => {
    loadPromise = null;
  });

  return loadPromise;
}

const geoCache = new Map<string, { lng: number; lat: number; formatted: string } | null>();
const geoInflight = new Map<
  string,
  Promise<{ lng: number; lat: number; formatted: string } | null>
>();

export function geocodeVenue(
  AMap: AMapNamespace,
  address: string
): Promise<{ lng: number; lat: number; formatted: string } | null> {
  const key = address.trim();
  if (geoCache.has(key)) return Promise.resolve(geoCache.get(key) ?? null);
  const pending = geoInflight.get(key);
  if (pending) return pending;

  const task = new Promise<{ lng: number; lat: number; formatted: string } | null>(
    (resolve) => {
      const geocoder = new AMap.Geocoder();
      geocoder.getLocation(key, (status, result) => {
        const location = result.geocodes?.[0]?.location;
        if (status !== "complete" || result.info !== "OK" || !location) {
          geoCache.set(key, null);
          resolve(null);
          return;
        }
        const value = {
          lng: location.getLng(),
          lat: location.getLat(),
          formatted: result.geocodes?.[0]?.formattedAddress || key,
        };
        geoCache.set(key, value);
        resolve(value);
      });
    }
  );

  geoInflight.set(key, task);
  return task.finally(() => {
    geoInflight.delete(key);
  });
}
