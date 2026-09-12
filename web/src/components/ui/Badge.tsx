"use client";

import type { ReactNode } from "react";

export type BadgeTone = "accent" | "danger" | "warning" | "success" | "default";

const TONE_CLASS: Record<BadgeTone, string> = {
  accent: "bg-accent/15 text-accent",
  danger: "bg-danger/15 text-danger",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
  default: "bg-[var(--surface-tertiary)] text-[var(--ink-soft)]",
};

export function Badge({
  tone = "default",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider whitespace-nowrap ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
