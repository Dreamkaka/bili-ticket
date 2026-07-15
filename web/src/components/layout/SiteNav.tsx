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
  onOpenNotifications,
  unreadCount = 0,
}: {
  connectionStatus: ConnectionStatus;
  systemHealthy: boolean;
  lastUpdate: number | null;
  active?: string;
  onOpenCommand?: () => void;
  onOpenNotifications?: () => void;
  unreadCount?: number;
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
            <span className="theme-ink text-sm font-semibold tracking-[0.2em]">
              我tm票呢
            </span>
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
          {onOpenNotifications ? (
            <button
              type="button"
              onClick={onOpenNotifications}
              className="theme-ink-faint relative flex h-8 w-8 items-center justify-center border border-border bg-surface/80 transition-colors hover:border-accent/50 hover:text-accent"
              aria-label={
                unreadCount > 0
                  ? `打开通知，${unreadCount} 条未读`
                  : "打开通知"
              }
              title="票务通知"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 9a6 6 0 1 1 12 0c0 3.5 1.5 5 2 6H4c.5-1 2-2.5 2-6Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 18a2 2 0 0 0 4 0"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              {unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>
          ) : null}
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
