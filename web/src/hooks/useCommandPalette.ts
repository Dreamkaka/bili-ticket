"use client";

import { useCallback, useEffect, useState } from "react";

export function useCommandPalette({ enabled = true }: { enabled?: boolean } = {}) {
  const [open, setOpen] = useState(false);

  const openPalette = useCallback(() => {
    if (!enabled) return;
    setOpen(true);
  }, [enabled]);

  const closePalette = useCallback(() => setOpen(false), []);

  const togglePalette = useCallback(() => {
    if (!enabled) return;
    setOpen((v) => !v);
  }, [enabled]);

  useEffect(() => {
    if (!enabled && open) setOpen(false);
  }, [enabled, open]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== "k") return;

      // 允许在任意位置打开；避免浏览器默认搜索
      e.preventDefault();
      e.stopPropagation();
      setOpen((v) => !v);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);

  return {
    open,
    setOpen,
    openPalette,
    closePalette,
    togglePalette,
  };
}
