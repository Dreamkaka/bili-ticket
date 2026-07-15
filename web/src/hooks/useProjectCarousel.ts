"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Diff, Project, Ticket } from "@/lib/types";
import { isAvailableStatus } from "@/lib/status";

const INTERVAL_MS = 8000;

function pickDefaultProject(projects: Project[], tickets: Ticket[]): Project | null {
  if (projects.length === 0) return null;
  const withAvailable = projects.find((p) =>
    tickets.some((t) => t.project_id === p.id && isAvailableStatus(t.status))
  );
  return withAvailable ?? projects[0] ?? null;
}

function projectIdsKey(projects: Project[]): string {
  return projects.map((p) => p.id).join("|");
}

export function useProjectCarousel(projects: Project[], tickets: Ticket[]) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [userLocked, setUserLocked] = useState(false);
  const [progress, setProgress] = useState(0);

  const projectsRef = useRef(projects);
  const focusIdRef = useRef(focusId);
  const userLockedRef = useRef(userLocked);
  const cycleStartRef = useRef(0);
  const rafRef = useRef(0);

  projectsRef.current = projects;
  focusIdRef.current = focusId;
  userLockedRef.current = userLocked;

  const idsKey = projectIdsKey(projects);

  // 初始化 / 列表 id 集合变化时校正焦点
  useEffect(() => {
    const list = projectsRef.current;
    if (list.length === 0) {
      setFocusId(null);
      return;
    }
    if (focusIdRef.current && list.some((p) => p.id === focusIdRef.current)) {
      return;
    }
    if (userLockedRef.current && focusIdRef.current) {
      // 锁定项已不存在，回退
    }
    const next = pickDefaultProject(list, tickets);
    setFocusId(next?.id ?? null);
    // tickets 仅在 id 列表变化时用于默认挑选，避免每 3s status_update 重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // 独立 RAF 进度：不依赖 projects 引用，避免 WS 刷新打断
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);

    if (userLocked) {
      setProgress(1);
      return;
    }

    if (projects.length <= 1) {
      setProgress(0);
      return;
    }

    cycleStartRef.current = performance.now();
    setProgress(0);

    const tick = (now: number) => {
      if (userLockedRef.current) return;

      const list = projectsRef.current;
      if (list.length <= 1) {
        setProgress(0);
        return;
      }

      const elapsed = now - cycleStartRef.current;
      const ratio = Math.min(1, elapsed / INTERVAL_MS);
      setProgress(ratio);

      if (ratio >= 1) {
        setFocusId((current) => {
          const items = projectsRef.current;
          if (items.length === 0) return null;
          const idx = items.findIndex((p) => p.id === current);
          const next = items[(idx + 1 + items.length) % items.length];
          return next?.id ?? items[0]?.id ?? null;
        });
        cycleStartRef.current = performance.now();
        setProgress(0);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [userLocked, projects.length, idsKey]);

  // 用户切换焦点后若未锁定，重新开始一轮进度
  const restartCycle = useCallback(() => {
    cycleStartRef.current = performance.now();
    setProgress(0);
  }, []);

  const focusProject = useMemo(
    () => projects.find((p) => p.id === focusId) ?? null,
    [projects, focusId]
  );

  const focusTickets = useMemo(
    () => tickets.filter((t) => t.project_id === focusProject?.id),
    [tickets, focusProject]
  );

  const focusIndex =
    focusProject != null
      ? Math.max(1, projects.findIndex((p) => p.id === focusProject.id) + 1)
      : 1;

  const selectProject = useCallback((id: string) => {
    setFocusId(id);
    setUserLocked(true);
    setProgress(1);
  }, []);

  const selectFromDiff = useCallback(
    (diff: Diff) => {
      const pid =
        diff.project_id ||
        projects.find((p) => p.id === diff.ticket_id)?.id ||
        projects.find(
          (p) => p.name && diff.ticket_name && diff.ticket_name.includes(p.name)
        )?.id;
      if (pid) selectProject(pid);
    },
    [projects, selectProject]
  );

  const resumeAutoplay = useCallback(() => {
    setUserLocked(false);
    restartCycle();
  }, [restartCycle]);

  return {
    focusProject,
    focusTickets,
    focusIndex,
    total: projects.length,
    progress,
    userLocked,
    selectProject,
    selectFromDiff,
    resumeAutoplay,
  };
}
