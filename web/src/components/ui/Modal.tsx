"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Modal({
  open,
  onOpenChange,
  label,
  className = "",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center p-0 sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className="animate-[modalBackdropIn_0.25s_ease-out_both] absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        className={`animate-[modalDialogIn_0.3s_var(--ease-out-expo)_both] relative ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
