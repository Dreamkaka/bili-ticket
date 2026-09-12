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

  return {
    open,
    setOpen,
    openPalette,
    closePalette,
    togglePalette,
  };
}
