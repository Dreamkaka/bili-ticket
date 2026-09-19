"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HOME_PANES } from "@/lib/panes";
import { scrollToId } from "@/lib/command";
import { formatClock } from "@/lib/status";
import type { ConnectionStatus } from "@/lib/types";

export function SiteFooter({
  connectionStatus,
  lastUpdate,
}: {
  connectionStatus?: ConnectionStatus;
  lastUpdate?: number | null;
}) {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [active, setActive] = useState<(typeof HOME_PANES)[number]["id"]>(
    HOME_PANES[0].id
  );

  useEffect(() => {
    if (!onHome) return;
    const rail = document.getElementById("home-rail");
    if (!rail) return;

    const sync = () => {
      const railLeft = rail.scrollLeft;
      let current: (typeof HOME_PANES)[number]["id"] = HOME_PANES[0].id;
      for (const pane of HOME_PANES) {
        const el = document.getElementById(pane.id);
        if (!el) continue;
        if (el.offsetLeft - rail.offsetLeft <= railLeft + 80) {
          current = pane.id;
        }
      }
      setActive(current);
    };

    sync();
    rail.addEventListener("scroll", sync, { passive: true });
    return () => rail.removeEventListener("scroll", sync);
  }, [onHome]);

  const jump = useCallback(
    (id: string) => {
      if (onHome) {
        setActive(id as (typeof HOME_PANES)[number]["id"]);
        scrollToId(id);
        return;
      }
      window.location.href = `/#${id}`;
    },
    [onHome]
  );

  const connLabel =
    connectionStatus === "connected"
      ? "LINKED"
      : connectionStatus === "connecting"
        ? "SYNC"
        : connectionStatus === "disconnected"
          ? "LOST"
          : null;

  return (
    <footer
      id="site-links"
      className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-t border-[var(--hairline)] bg-[var(--background)] px-2 pb-[env(safe-area-inset-bottom,0px)] sm:h-8 sm:px-3 sm:pb-0"
    >
      <span className="mr-1 hidden font-mono text-[10px] tracking-[0.08em] text-[var(--ink-faint)] uppercase sm:inline">
        jump
      </span>
      {HOME_PANES.map((pane) => {
        const isActive = active === pane.id;
        return (
          <button
            key={pane.id}
            type="button"
            onClick={() => jump(pane.id)}
            className={`shrink-0 px-2 py-1.5 font-mono text-[10px] tracking-[0.08em] uppercase transition-colors sm:py-1 ${
              isActive
                ? "text-accent"
                : "text-[var(--ink-faint)] hover:text-[var(--ink)]"
            }`}
          >
            <span className="mr-1 text-[9px] tabular-nums opacity-60">
              {pane.index}
            </span>
            {pane.title}
          </button>
        );
      })}
      <span className="mx-1 hidden h-3 w-px shrink-0 bg-[var(--hairline)] sm:block" />
      <a
        href="/map"
        className="shrink-0 px-2 py-1 font-mono text-[10px] tracking-[0.08em] text-[var(--ink-faint)] uppercase transition-colors hover:text-[var(--ink)]"
      >
        MAP
      </a>
      <a
        href="/guides"
        className="shrink-0 px-2 py-1 font-mono text-[10px] tracking-[0.08em] text-[var(--ink-faint)] uppercase transition-colors hover:text-[var(--ink)]"
      >
        GUIDES
      </a>
      <a
        href="/articles"
        className="shrink-0 px-2 py-1 font-mono text-[10px] tracking-[0.08em] text-[var(--ink-faint)] uppercase transition-colors hover:text-[var(--ink)]"
      >
        ARTICLES
      </a>
      <span className="ml-auto hidden shrink-0 items-center gap-3 font-mono text-[10px] tracking-[0.08em] text-[var(--ink-faint)] uppercase sm:flex">
        {connLabel ? <span>{connLabel}</span> : null}
        {lastUpdate != null ? <span>{formatClock(lastUpdate)}</span> : null}
        <span>TICKET MONITOR</span>
      </span>
    </footer>
  );
}
