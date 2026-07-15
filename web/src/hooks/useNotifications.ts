"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Diff } from "@/lib/types";

/**
 * 未读通知：以已见最大 diff id 为水位；打开面板时标记已读。
 */
export function useNotifications(diffs: Diff[], enabled: boolean) {
  const [open, setOpen] = useState(false);
  const [seenMaxId, setSeenMaxId] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const currentMaxId = useMemo(
    () => diffs.reduce((m, d) => Math.max(m, d.id ?? 0), 0),
    [diffs]
  );

  // 首次启用时与当前水位对齐，不把历史当未读
  useEffect(() => {
    if (!enabled || hydrated) return;
    setSeenMaxId(currentMaxId);
    setHydrated(true);
  }, [enabled, hydrated, currentMaxId]);

  const unreadCount = useMemo(() => {
    if (!hydrated) return 0;
    return diffs.filter((d) => (d.id ?? 0) > seenMaxId).length;
  }, [diffs, seenMaxId, hydrated]);

  const markAllRead = useCallback(() => {
    setSeenMaxId((prev) => Math.max(prev, currentMaxId));
  }, [currentMaxId]);

  const openPanel = useCallback(() => {
    setOpen(true);
    setSeenMaxId((prev) => Math.max(prev, currentMaxId));
  }, [currentMaxId]);

  const closePanel = useCallback(() => setOpen(false), []);

  return {
    open,
    setOpen: (v: boolean) => {
      if (v) openPanel();
      else closePanel();
    },
    openPanel,
    closePanel,
    unreadCount,
    markAllRead,
  };
}
