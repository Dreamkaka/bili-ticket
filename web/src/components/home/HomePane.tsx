"use client";

import type { CSSProperties, ReactNode } from "react";

export function HomePane({
  id,
  index,
  title,
  grow = false,
  flush = false,
  width = "min(92vw, 680px)",
  children,
}: {
  id: string;
  index: string;
  title: string;
  grow?: boolean;
  flush?: boolean;
  width?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      data-index={index}
      style={{ "--pane-w": width } as CSSProperties}
      className={`group/pane flex h-full min-h-0 w-[min(100%,var(--pane-w))] shrink-0 snap-start flex-col overflow-hidden border-l border-[var(--hairline)] first:border-l-0 ${
        grow ? "max-md:w-[88vw] md:grow md:w-[var(--pane-w)]" : "max-md:w-[85vw]"
      }`}
    >
      <header className="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--hairline)] bg-[var(--background)] px-4 md:px-6">
        <span className="text-[10px] leading-none text-accent" aria-hidden>
          •
        </span>
        <h2 className="font-mono text-[11px] tracking-[0.08em] text-[var(--ink-faint)] uppercase">
          {title}
        </h2>
        <span className="ml-auto font-mono text-[10px] text-[var(--ink-faint)]/45 tabular-nums">
          {index}
        </span>
      </header>
      <div
        className={
          flush
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : "thin-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain px-4 py-4 md:px-6 md:py-5"
        }
      >
        {children}
      </div>
    </section>
  );
}
