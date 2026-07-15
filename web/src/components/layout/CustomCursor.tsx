"use client";

import { useEffect, useRef, useState } from "react";

const RING_LERP = 0.18;
const HOVER_SCALE = 1.55;

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
  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);

  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });
  const ring = useRef({ x: 0, y: 0 });
  const raf = useRef(0);

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
      className={`pointer-events-none fixed inset-0 z-[200] transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden
    >
      <div
        ref={ringRef}
        className="absolute top-0 left-0 will-change-transform"
        style={{
          width: 28,
          height: 28,
          borderRadius: "9999px",
          border: "1.5px solid rgba(255,255,255,0.85)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.25)",
          transition: "width 0.2s var(--ease-out-soft), height 0.2s var(--ease-out-soft), border-color 0.2s ease",
          ...(hovering
            ? {
                width: 28 * HOVER_SCALE,
                height: 28 * HOVER_SCALE,
                borderColor: "rgba(255,255,255,1)",
              }
            : null),
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
