"use client";

import { Chip } from "@heroui/react";
import type { ConnectionStatus } from "@/lib/types";
import { formatClock } from "@/lib/status";
import { modKeyLabel } from "@/lib/command";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const NAV = [
  { id: "home", en: "INDEX", zh: "首页", href: "#home" },
  { id: "calendar", en: "CALENDAR", zh: "日历", href: "#calendar" },
  { id: "projects", en: "PROJECTS", zh: "项目", href: "#projects" },
  { id: "nodes", en: "NODES", zh: "节点", href: "#nodes" },
  { id: "trends", en: "TRENDS", zh: "趋势", href: "#trends" },
] as const;

export function SiteNav({
  connectionStatus,
  systemHealthy,
  lastUpdate,
  active = "home",
  onOpenCommand,
}: {
  connectionStatus: ConnectionStatus;
  systemHealthy: boolean;
  lastUpdate: number | null;
  active?: string;
  onOpenCommand?: () => void;
}) {
  const connLabel =
    connectionStatus === "connected"
      ? "LINKED"
      : connectionStatus === "connecting"
        ? "SYNC"
        : "LOST";

  const mod = modKeyLabel();

  return (
    <header className="theme-nav fixed inset-x-0 top-0 z-50 border-b">
      <div className="flex h-14 w-full items-center justify-between gap-4 px-4 sm:h-16 sm:px-6 lg:px-8">
        <a href="#home" className="flex shrink-0 items-center gap-3">
          <div className="flex h-8 items-center border-l-2 border-accent pl-2">
            <span className="theme-ink text-sm font-semibold tracking-[0.2em]">我tm票呢</span>
          </div>
          <span className="theme-ink-faint hidden text-[10px] tracking-[0.25em] sm:inline">
            where are my ticket?!
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex lg:gap-2">
          {NAV.map((item) => {
            const isActive = active === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                className={`group flex min-w-[4.5rem] flex-col items-center px-2 py-1 transition-colors duration-300 ${
                  isActive ? "text-accent" : "theme-ink-faint hover:text-ink"
                }`}
              >
                <span className="text-[11px] font-semibold tracking-[0.18em] transition-transform duration-300 group-hover:-translate-y-0.5">
                  {item.en}
                </span>
                <span className="text-[10px] opacity-80 transition-opacity duration-300">
                  {item.zh}
                </span>
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {onOpenCommand ? (
            <button
              type="button"
              onClick={onOpenCommand}
              className="theme-ink-faint hidden h-8 items-center gap-1.5 border border-border bg-surface/80 px-2 text-[10px] tracking-wider transition-colors hover:border-accent/50 hover:text-accent sm:inline-flex"
              aria-label="打开命令面板"
              title={`${mod}+K 命令面板`}
            >
              <span className="opacity-80">CMD</span>
              <kbd className="rounded border border-[var(--hairline)] px-1 py-0.5 font-mono text-[10px]">
                {mod}K
              </kbd>
            </button>
          ) : null}
          <ThemeToggle />
          <Chip
            size="sm"
            variant="soft"
            color={connectionStatus === "connected" ? "accent" : "danger"}
            className="rounded-sm"
          >
            {connLabel}
          </Chip>
          <Chip
            size="sm"
            variant="soft"
            color={systemHealthy ? "accent" : "warning"}
            className="hidden rounded-sm sm:inline-flex"
          >
            {systemHealthy ? "NOMINAL" : "ALERT"}
          </Chip>
          <span className="theme-ink-faint hidden font-mono text-[10px] tracking-wider lg:inline">
            {lastUpdate ? formatClock(lastUpdate) : "--:--:--"}
          </span>
        </div>
      </div>
    </header>
  );
}
