import type { AMapInstance, AMapLayer, AMapNamespace } from "@/lib/amap";
import { typhoonColor, type TyphoonPoint, type TyphoonStorm } from "@/lib/fanstudio";

export type TyphoonHandle = {
  overlays: AMapLayer[];
  storms: TyphoonStorm[];
};

export function drawTyphoons(
  AMap: AMapNamespace,
  map: AMapInstance,
  storms: TyphoonStorm[]
): TyphoonHandle {
  const overlays: AMapLayer[] = [];
  for (const storm of storms) {
    const last = storm.track[storm.track.length - 1];
    // 半径单位为 km，四象限依次为东北、东南、西南、西北。
    // 使用球面正算，避免用经纬度等距偏移导致高纬度风圈变形。
    for (const ring of last?.windRadii ?? []) {
      const lat = last.lat * Math.PI / 180;
      const lng = last.lng * Math.PI / 180;
      const path: [number, number][] = [];
      // 合并四象限为一个面，保留原始半径，仅绘制外边界而非中心接缝。
      for (let quadrant = 0; quadrant < 4; quadrant++) {
        const distance = ring.km[quadrant] / 6371.0088;
        for (let degree = quadrant * 90; degree <= (quadrant + 1) * 90; degree += 2) {
          const bearing = degree * Math.PI / 180;
          const targetLat = Math.asin(Math.sin(lat) * Math.cos(distance) + Math.cos(lat) * Math.sin(distance) * Math.cos(bearing));
          const targetLng = lng + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(lat), Math.cos(distance) - Math.sin(lat) * Math.sin(targetLat));
          path.push([((targetLng * 180 / Math.PI + 540) % 360) - 180, targetLat * 180 / Math.PI]);
        }
      }
      path.push(path[0]);
      const color = ring.level === 7 ? "#56c8e8" : ring.level === 10 ? "#f2c66d" : "#f58289";
      const zIndex = 40 + ring.level;
      overlays.push(new AMap.Polygon({
        path, fillColor: color, fillOpacity: 0.055,
        strokeOpacity: 0, strokeWeight: 0,
        zIndex, bubble: true,
      }));
      // 两层低透明度描边形成柔和光晕，不增加风圈的实际覆盖范围。
      for (const [strokeWeight, strokeOpacity] of [[7, 0.07], [4, 0.12], [1.5, 0.75]]) {
        overlays.push(new AMap.Polyline({
          path, strokeColor: color, strokeWeight, strokeOpacity,
          lineJoin: "round", lineCap: "round", zIndex: zIndex + 1,
          bubble: true,
        }));
      }
    }
    const paths = [
      { agency: "实况", issuedTime: "", points: storm.track, forecast: false },
      ...storm.forecast.map((f) => ({ ...f, forecast: true })),
    ];
    for (const path of paths) {
      let previous: TyphoonPoint | undefined = path.forecast ? last : undefined;
      for (const point of path.points) {
        const color = typhoonColor(point.strong);
        if (previous) {
          overlays.push(new AMap.Polyline({
            path: [[previous.lng, previous.lat], [point.lng, point.lat]],
            strokeColor: color,
            strokeWeight: path.forecast ? 2 : 3,
            strokeStyle: path.forecast ? "dashed" : "solid",
            strokeDasharray: [8, 6],
            zIndex: path.forecast ? 79 : 80,
          }));
        }
        // DOM title 使用纯文本，避免接口内容作为 HTML 执行。
        const dot = document.createElement("button");
        dot.type = "button";
        const current = !path.forecast && point === last;
        dot.style.cssText = `width:${current ? 18 : 12}px;height:${current ? 18 : 12}px;border-radius:50%;border:2px solid ${path.forecast ? color : "white"};background:${path.forecast ? "#18202b" : color};box-shadow:0 0 3px #000;cursor:pointer;`;
        dot.title = [
          `${storm.name} (${storm.tfid}) · ${path.agency}${path.forecast ? "预测" : current ? "最新位置" : ""}`,
          `${point.time} · ${point.strong} · ${point.power || "未知"}级`,
          `风速 ${point.speed ?? "未知"} m/s · 气压 ${point.pressure ?? "未知"} hPa`,
          `${point.lng}, ${point.lat}`,
          ...point.windRadii.map((ring) => `${ring.level}级风圈半径 (km)：东北 ${ring.km[0]} / 东南 ${ring.km[1]} / 西南 ${ring.km[2]} / 西北 ${ring.km[3]}`),
          point.windRadii.length ? "风圈：7级蓝 / 10级黄 / 12级红；地图显示最新实况风圈" : "该时刻未提供有效风圈半径",
          path.issuedTime ? `起报时间 ${path.issuedTime}` : "",
        ].filter(Boolean).join("\n");
        dot.setAttribute("aria-label", dot.title);
        // 手机没有 hover，点击可展开同一份详情。
        const detail = document.createElement("div");
        detail.textContent = dot.title;
        detail.style.cssText = "display:none;position:absolute;bottom:22px;left:0;width:240px;padding:10px;background:#18202b;color:white;white-space:pre-line;font-size:12px;line-height:1.6;border:1px solid #64748b;";
        const content = document.createElement("div");
        content.style.position = "relative";
        content.append(dot, detail);
        dot.onclick = () => { detail.style.display = detail.style.display === "none" ? "block" : "none"; };
        overlays.push(new AMap.Marker({
          position: [point.lng, point.lat], content, anchor: "center",
          zIndex: current ? 120 : path.forecast ? 90 : 100,
        }));
        previous = point;
      }
    }
  }
  if (overlays.length) map.add(overlays);
  return { overlays, storms };
}

export function clearTyphoons(map: AMapInstance, handle: TyphoonHandle | null) {
  if (handle?.overlays.length) map.remove(handle.overlays);
}
