"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "@/lib/types";
import { pickFeaturedProject } from "@/lib/featured";

const INTERVAL_MS = 8000;

function projectIdsKey(projects: Project[]): string {
  return projects.map((p) => p.id).join("|");
}

export function useProjectCarousel(projects: Project[], enabled: boolean) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [userLocked, setUserLocked] = useState(false);
  const [cycle, setCycle] = useState(0);

  const projectsRef = useRef(projects);
  const userLockedRef = useRef(userLocked);
  projectsRef.current = projects;
  userLockedRef.current = userLocked;

  const idsKey = projectIdsKey(projects);

  useEffect(() => {
    const list = projectsRef.current;
    if (list.length === 0) {
      setFocusId(null);
      return;
    }
    setFocusId((current) => {
      if (current && list.some((p) => p.id === current)) return current;
      return pickFeaturedProject(list)?.id ?? list[0]?.id ?? null;
    });
  }, [idsKey]);

  useEffect(() => {
    if (!enabled || userLocked || projects.length <= 1) return;
    const timer = window.setInterval(() => {
      if (userLockedRef.current) return;
      setFocusId((current) => {
        const items = projectsRef.current;
        if (items.length === 0) return null;
        const idx = items.findIndex((p) => p.id === current);
        const next = items[(idx + 1 + items.length) % items.length];
        return next?.id ?? items[0]?.id ?? null;
      });
      setCycle((n) => n + 1);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, userLocked, projects.length, idsKey]);

  const focusProject = useMemo(
    () => projects.find((p) => p.id === focusId) ?? null,
    [projects, focusId]
  );

  const selectProject = useCallback((id: string) => {
    setFocusId(id);
    setUserLocked(true);
  }, []);

  const resumeAutoplay = useCallback(() => {
    setUserLocked(false);
  }, []);

  const focusIndex =
    focusProject != null
      ? Math.max(1, projects.findIndex((p) => p.id === focusProject.id) + 1)
      : 1;

  return {
    focusProject,
    focusIndex,
    total: projects.length,
    userLocked,
    cycle,
    selectProject,
    resumeAutoplay,
  };
}
