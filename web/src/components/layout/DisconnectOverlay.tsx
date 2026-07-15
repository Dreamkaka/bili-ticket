"use client";

import { Spinner } from "@heroui/react";

export function DisconnectOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-[55] flex flex-col items-center justify-center bg-background/90 p-6 backdrop-blur-sm">
      <Spinner size="lg" className="text-accent" />
      <p className="theme-ink animate-fade-in-up mt-4 text-sm font-medium tracking-wider">
        与后端连接已断开
      </p>
      <p className="theme-ink-faint animate-soft-pulse mt-1 text-xs tracking-[0.2em]">
        RETRYING LINK…
      </p>
    </div>
  );
}
