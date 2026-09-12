"use client";

import { useEffect, useState } from "react";

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  over: boolean;
};

function compute(targetMs: number | null): CountdownParts {
  if (targetMs == null) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, over: true };
  }
  const diff = targetMs - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, over: true };
  }
  const seconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    totalMs: diff,
    over: false,
  };
}

export function useCountdown(targetMs: number | null): CountdownParts {
  const [parts, setParts] = useState(() => compute(targetMs));

  useEffect(() => {
    setParts(compute(targetMs));
    if (targetMs == null) return;
    const timer = window.setInterval(() => setParts(compute(targetMs)), 1000);
    return () => window.clearInterval(timer);
  }, [targetMs]);

  return parts;
}
