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

function sameProject(a: Project | null, b: Project | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.cover === b.cover &&
    a.venue_name === b.venue_name &&
    a.project_label === b.project_label &&
    a.type === b.type &&
    a.assigned_node === b.assigned_node
  );
}

export function useProjectCarousel(projects: Project[], tickets: Ticket[]) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [userLocked, setUserLocked] = useState(false);

  const projectsRef = useRef(projects);
  const ticketsRef = useRef(tickets);
  const focusIdRef = useRef(focusId);
  const userLockedRef = useRef(userLocked);
  const cycleStartRef = useRef(0);
  const rafRef = useRef(0);
  const progressElRef = useRef<HTMLElement | null>(null);
  const focusProjectCache = useRef<Project | null>(null);

  projectsRef.current = projects;
  ticketsRef.current = tickets;
  focusIdRef.current = focusId;
  userLockedRef.current = userLocked;

  const idsKey = projectIdsKey(projects);

  const setProgressWidth = useCallback((ratio: number) => {
    const el = progressElRef.current;
    if (el) el.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  }, []);

  const registerProgressEl = useCallback(
    (el: HTMLElement | null) => {
      progressElRef.current = el;
      if (!el) return;
      if (userLockedRef.current) {
        el.style.width = "100%";
      } else if (projectsRef.current.length <= 1) {
        el.style.width = "0%";
      } else {
        const elapsed = performance.now() - cycleStartRef.current;
        const ratio = Math.min(1, Math.max(0, elapsed / INTERVAL_MS));
        el.style.width = `${ratio * 100}%`;
      }
    },
    []
  );

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
    const next = pickDefaultProject(list, ticketsRef.current);
    setFocusId(next?.id ?? null);
  }, [idsKey]);

  // RAF 只写 DOM + 到期切焦点，不 setProgress
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);

    if (userLocked) {
      setProgressWidth(1);
      return;
    }

    if (projects.length <= 1) {
      setProgressWidth(0);
      return;
    }

    cycleStartRef.current = performance.now();
    setProgressWidth(0);

    const tick = (now: number) => {
      if (userLockedRef.current) return;

      const list = projectsRef.current;
      if (list.length <= 1) {
        setProgressWidth(0);
        return;
      }

      const elapsed = now - cycleStartRef.current;
      const ratio = Math.min(1, elapsed / INTERVAL_MS);
      setProgressWidth(ratio);

      if (ratio >= 1) {
        setFocusId((current) => {
          const items = projectsRef.current;
          if (items.length === 0) return null;
          const idx = items.findIndex((p) => p.id === current);
          const next = items[(idx + 1 + items.length) % items.length];
          return next?.id ?? items[0]?.id ?? null;
        });
        cycleStartRef.current = performance.now();
        setProgressWidth(0);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [userLocked, projects.length, idsKey, setProgressWidth]);

  const restartCycle = useCallback(() => {
    cycleStartRef.current = performance.now();
    setProgressWidth(0);
  }, [setProgressWidth]);

  const focusProject = useMemo(() => {
    const next = projects.find((p) => p.id === focusId) ?? null;
    if (sameProject(focusProjectCache.current, next)) {
      return focusProjectCache.current;
    }
    focusProjectCache.current = next;
    return next;
  }, [projects, focusId]);

  const focusTickets = useMemo(() => {
    if (!focusProject) return [] as Ticket[];
    return tickets.filter((t) => t.project_id === focusProject.id);
  }, [tickets, focusProject]);

  const focusIndex =
    focusProject != null
      ? Math.max(1, projects.findIndex((p) => p.id === focusProject.id) + 1)
      : 1;

  const selectProject = useCallback(
    (id: string) => {
      setFocusId(id);
      setUserLocked(true);
      setProgressWidth(1);
    },
    [setProgressWidth]
  );

  const selectFromDiff = useCallback(
    (diff: Diff) => {
      const list = projectsRef.current;
      const pid =
        diff.project_id ||
        list.find((p) => p.id === diff.ticket_id)?.id ||
        list.find(
          (p) => p.name && diff.ticket_name && diff.ticket_name.includes(p.name)
        )?.id;
      if (pid) selectProject(pid);
    },
    [selectProject]
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
    userLocked,
    selectProject,
    selectFromDiff,
    resumeAutoplay,
    registerProgressEl,
  };
}
