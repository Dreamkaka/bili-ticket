"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground shadow-lg shadow-accent/20 hover:brightness-110 active:scale-[0.98]",
  secondary:
    "theme-panel-strong theme-ink border-[var(--hairline)] hover:border-accent/50 hover:text-accent active:scale-[0.98]",
  ghost:
    "theme-ink-soft bg-transparent hover:bg-[var(--surface-secondary)] hover:text-accent active:scale-[0.98]",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-10 px-4 text-sm sm:min-h-9",
  lg: "min-h-11 px-5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 border border-transparent font-semibold tracking-wide transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
