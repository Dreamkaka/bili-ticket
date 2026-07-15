"use client";

import { useEffect, useRef, useState } from "react";

const RING_LERP = 0.18;
const HOVER_SCALE = 1.55;
const BASE = 28;

function isInteractive(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  return Boolean(
    el.closest(
      "a, button, input, textarea, select, label, summary, [role='button'], [role='link'], [data-cursor='pointer'], .cursor-pointer"
    )
  );
}

export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });
  const ring = useRef({ x: 0, y: 0 });
  const raf = useRef(0);
  const visibleRef = useRef(false);
  const hoveringRef = useRef(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncEnabled = () => setEnabled(fine.matches && !reduce.matches);
    syncEnabled();

    fine.addEventListener("change", syncEnabled);
    reduce.addEventListener("change", syncEnabled);
    return () => {
      fine.removeEventListener("change", syncEnabled);
      reduce.removeEventListener("change", syncEnabled);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    document.documentElement.classList.add("custom-cursor");

    const setVisible = (v: boolean) => {
      if (visibleRef.current === v) return;
      visibleRef.current = v;
      const root = rootRef.current;
      if (root) root.style.opacity = v ? "1" : "0";
    };

    const setHovering = (v: boolean) => {
      if (hoveringRef.current === v) return;
      hoveringRef.current = v;
      const ringEl = ringRef.current;
      if (!ringEl) return;
      const size = v ? BASE * HOVER_SCALE : BASE;
      ringEl.style.width = `${size}px`;
      ringEl.style.height = `${size}px`;
      ringEl.style.borderColor = v
        ? "rgba(255,255,255,1)"
        : "rgba(255,255,255,0.85)";
    };

    const onMove = (e: MouseEvent) => {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;
      setVisible(true);
      setHovering(isInteractive(e.target));

      const dot = dotRef.current;
      if (dot) {
        dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      }
    };

    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);
    const onDown = () => setHovering(true);
    const onUp = (e: MouseEvent) => setHovering(isInteractive(e.target));

    const tick = () => {
      const target = pos.current;
      const current = ring.current;
      current.x += (target.x - current.x) * RING_LERP;
      current.y += (target.y - current.y) * RING_LERP;

      const ringEl = ringRef.current;
      if (ringEl) {
        ringEl.style.transform = `translate3d(${current.x}px, ${current.y}px, 0) translate(-50%, -50%)`;
      }
      raf.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);
    raf.current = requestAnimationFrame(tick);

    return () => {
      document.documentElement.classList.remove("custom-cursor");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      cancelAnimationFrame(raf.current);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed inset-0 z-[200] opacity-0 transition-opacity duration-200"
      aria-hidden
    >
      <div
        ref={ringRef}
        className="absolute top-0 left-0 will-change-transform"
        style={{
          width: BASE,
          height: BASE,
          borderRadius: "9999px",
          border: "1.5px solid rgba(255,255,255,0.85)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.25)",
          transition:
            "width 0.2s var(--ease-out-soft), height 0.2s var(--ease-out-soft), border-color 0.2s ease",
        }}
      />
      <div
        ref={dotRef}
        className="absolute top-0 left-0 will-change-transform"
        style={{
          width: 6,
          height: 6,
          borderRadius: "9999px",
          background: "#fff",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
        }}
      />
    </div>
  );
}
