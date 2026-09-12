"use client";

import type { ReactNode } from "react";

export function HomeRail({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-3.5rem-2.5rem)] min-h-0 w-full flex-1 flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)] md:h-[calc(100dvh-3.5rem-2rem)]">
      <div
        id="home-rail"
        role="group"
        aria-label="首页分区，横向排列"
        className="home-rail flex min-h-0 flex-1 flex-row snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
      >
        {children}
      </div>
    </div>
  );
}
