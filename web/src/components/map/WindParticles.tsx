"use client";

import { useEffect, useRef } from "react";
import type { AMapInstance, AMapPixel } from "@/lib/amap";
import { sampleWind, type WindField } from "@/lib/fanstudio";

type Particle = { lng: number; lat: number; age: number; maxAge: number };

function pixelXY(p: AMapPixel): { x: number; y: number } {
  return {
    x: typeof p.getX === "function" ? p.getX() : p.x,
    y: typeof p.getY === "function" ? p.getY() : p.y,
  };
}

function windColor(speed: number, alpha: number): string {
  const t = Math.min(speed / 18, 1);
  const r = Math.round(80 + 175 * t);
  const g = Math.round(200 - 80 * t);
  const b = Math.round(255 - 140 * t);
  return `rgba(${r},${g},${b},${alpha})`;
}

function zoomScale(zoom: number): { count: number; width: number; dt: number; alpha: number } {
  const z = Number.isFinite(zoom) ? zoom : 5;
  if (z >= 12) return { count: 500, width: 0.7, dt: 4, alpha: 0.38 };
  if (z >= 9) return { count: 900, width: 0.95, dt: 6, alpha: 0.5 };
  if (z >= 7) return { count: 1400, width: 1.2, dt: 9, alpha: 0.68 };
  return { count: 2000, width: 1.55, dt: 12, alpha: 0.88 };
}

export function WindParticles({
  map,
  field,
  enabled,
}: {
  map: AMapInstance | null;
  field: WindField | null;
  enabled: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map || !field || !enabled) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;
    const scaleRef = { current: zoomScale(map.getZoom?.() ?? 5) };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = (): Particle | null => {
      const bounds = map.getBounds?.();
      if (!bounds) return null;
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const lng = sw.getLng() + Math.random() * (ne.getLng() - sw.getLng());
      const lat = sw.getLat() + Math.random() * (ne.getLat() - sw.getLat());
      return { lng, lat, age: 0, maxAge: 70 + Math.random() * 90 };
    };

    const fill = () => {
      scaleRef.current = zoomScale(map.getZoom?.() ?? 5);
      const next: Particle[] = [];
      for (let i = 0; i < scaleRef.current.count; i++) {
        const p = spawn();
        if (p) {
          p.age = Math.random() * p.maxAge;
          next.push(p);
        }
      }
      particlesRef.current = next;
    };

    const step = () => {
      if (!running) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.fillStyle = "rgba(0,0,0,0.055)";
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        p.age += 1;
        const uv = sampleWind(field, p.lng, p.lat);
        if (!uv || p.age > p.maxAge) {
          const born = spawn();
          if (born) particles[i] = born;
          continue;
        }

        const from = map.lngLatToContainer?.([p.lng, p.lat]);
        const latRad = (p.lat * Math.PI) / 180;
        const metersPerDegLat = 110540;
        const metersPerDegLng = Math.max(111320 * Math.cos(latRad), 1);
        const dt = scaleRef.current.dt;
        p.lng += (uv.u * dt) / metersPerDegLng;
        p.lat += (uv.v * dt) / metersPerDegLat;
        const to = map.lngLatToContainer?.([p.lng, p.lat]);
        if (!from || !to) continue;
        const a = pixelXY(from);
        const b = pixelXY(to);
        if (
          a.x < -20 ||
          a.y < -20 ||
          a.x > w + 20 ||
          a.y > h + 20
        ) {
          const born = spawn();
          if (born) particles[i] = born;
          continue;
        }
        ctx.beginPath();
        ctx.strokeStyle = windColor(uv.speed, scaleRef.current.alpha);
        ctx.lineWidth = scaleRef.current.width;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(step);
    };

    resize();
    fill();
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    rafRef.current = requestAnimationFrame(step);

    const onView = () => fill();
    map.on?.("mapmove", onView);
    map.on?.("zoomchange", onView);
    window.addEventListener("resize", resize);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      map.off?.("mapmove", onView);
      map.off?.("zoomchange", onView);
      window.removeEventListener("resize", resize);
    };
  }, [map, field, enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[6] h-full w-full"
    />
  );
}
