"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@heroui/react";
import type { ConnectionStatus, Project } from "@/lib/types";
import { formatClock } from "@/lib/status";
import { useTheme } from "@/lib/theme";
import {
  GROUP_LABEL,
  matchesQuery,
  modKeyLabel,
  scrollToId,
  type CommandGroup,
  type CommandItem,
} from "@/lib/command";

const GROUP_ORDER: CommandGroup[] = ["nav", "action", "project"];
const PROJECT_CAP = 20;

export function CommandPalette({
  open,
  onOpenChange,
  projects,
  connectionStatus,
  lastUpdate,
  systemHealthy,
  onSelectProject,
  onOpenNotifications,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  connectionStatus: ConnectionStatus;
  lastUpdate: number | null;
  systemHealthy: boolean;
  onSelectProject?: (id: string) => void;
  onOpenNotifications?: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = () => onOpenChange(false);

  const items = useMemo(() => {
    const connLabel =
      connectionStatus === "connected"
        ? "LINKED"
        : connectionStatus === "connecting"
          ? "SYNC"
          : "LOST";
    const clock = lastUpdate ? formatClock(lastUpdate) : "--:--:--";
    const health = systemHealthy ? "NOMINAL" : "ALERT";

    const nav: CommandItem[] = [
      {
        id: "nav-home",
        group: "nav",
        label: "首页",
        description: "INDEX · 首屏舞台",
        keywords: ["home", "index", "首页", "顶栏"],
        run: () => scrollToId("home"),
      },
      {
        id: "nav-calendar",
        group: "nav",
        label: "活动日历",
        description: "CALENDAR · 举办日期",
        keywords: ["calendar", "日历", "活动", "日期", "日程"],
        run: () => scrollToId("calendar"),
      },
      {
        id: "nav-projects",
        group: "nav",
        label: "监控项目",
        description: "PROJECTS",
        keywords: ["projects", "项目", "票档"],
        run: () => scrollToId("projects"),
      },
      {
        id: "nav-events",
        group: "nav",
        label: "事件动态",
        description: "EVENTS · Diff 流",
        keywords: ["events", "diffs", "事件", "动态"],
        run: () => scrollToId("events"),
      },
      {
        id: "nav-trends",
        group: "nav",
        label: "库存趋势",
        description: "TRENDS",
        keywords: ["trends", "chart", "趋势", "库存"],
        run: () => scrollToId("trends"),
      },
      {
        id: "nav-nodes",
        group: "nav",
        label: "采集节点",
        description: "NODES",
        keywords: ["nodes", "节点", "probe"],
        run: () => scrollToId("nodes"),
      },
    ];

    const actions: CommandItem[] = [
      {
        id: "action-notifications",
        group: "action",
        label: "打开票务通知",
        description: "ALERTS · Toast 历史",
        keywords: ["notify", "toast", "通知", "提醒", "动态", "alert"],
        run: () => onOpenNotifications?.(),
      },
      {
        id: "action-theme",
        group: "action",
        label: theme === "dark" ? "切换到日间模式" : "切换到夜间模式",
        description: "主题外观",
        keywords: ["theme", "dark", "light", "主题", "日间", "夜间", "模式"],
        run: () => toggleTheme(),
      },
      {
        id: "action-top",
        group: "action",
        label: "回到顶部",
        description: "平滑滚动到页面顶端",
        keywords: ["top", "scroll", "顶部", "回到顶部"],
        run: () => window.scrollTo({ top: 0, behavior: "smooth" }),
      },
      {
        id: "action-copy-status",
        group: "action",
        label: "复制连接状态",
        description: `${connLabel} · ${health} · ${clock}`,
        keywords: ["copy", "status", "复制", "状态", "连接"],
        run: () => {
          const text = [
            "票务监控状态",
            `连接: ${connLabel}`,
            `系统: ${health}`,
            `更新: ${clock}`,
            `项目数: ${projects.length}`,
          ].join("\n");
          void navigator.clipboard?.writeText(text);
        },
      },
      {
        id: "action-resume",
        group: "action",
        label: "滚动到项目并查看焦点",
        description: "PROJECTS 区域",
        keywords: ["focus", "carousel", "轮播", "焦点"],
        run: () => scrollToId("projects"),
      },
    ];

    const projectItems: CommandItem[] = projects.slice(0, 80).map((p) => ({
      id: `project-${p.id}`,
      group: "project" as const,
      label: p.name || p.id,
      description: [p.venue_name, p.project_label, p.id].filter(Boolean).join(" · "),
      keywords: [p.name || "", p.venue_name || "", p.id, p.project_label || "", "项目"],
      run: () => {
        onSelectProject?.(p.id);
        scrollToId(`project-${p.id}`);
      },
    }));

    return [...nav, ...actions, ...projectItems];
  }, [
    connectionStatus,
    lastUpdate,
    systemHealthy,
    theme,
    toggleTheme,
    projects,
    onSelectProject,
    onOpenNotifications,
  ]);

  const filtered = useMemo(() => {
    const list = items.filter((item) => matchesQuery(item, query));
    // 项目组过多时裁剪
    let projectCount = 0;
    return list.filter((item) => {
      if (item.group !== "project") return true;
      projectCount += 1;
      return projectCount <= PROJECT_CAP;
    });
  }, [items, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActive(0);
      return;
    }
    setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open, filtered]);

  const runItem = (item: CommandItem | undefined) => {
    if (!item) return;
    close();
    // 等 Modal 关闭后再执行滚动，避免滚动被锁
    window.setTimeout(() => item.run(), 40);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) =>
        filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      runItem(filtered[active]);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(Math.max(0, filtered.length - 1));
    }
  };

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      items: filtered
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.group === group),
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  const mod = modKeyLabel();

  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={onOpenChange}
      variant="blur"
      className="z-[10000]"
    >
      <Modal.Container className="items-center justify-center" placement="center">
        <Modal.Dialog
          aria-label="命令面板"
          className="theme-panel mx-auto mb-[env(safe-area-inset-bottom,0px)] w-[min(100vw-1rem,32rem)] overflow-hidden rounded-sm border p-0 shadow-2xl"
        >
          <div className="border-b border-[var(--hairline)] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="theme-ink-faint text-[10px] tracking-[0.2em]">CMD</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="搜索命令、页面或项目…"
                className="theme-ink min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--ink-faint)] sm:text-sm"
                aria-label="命令搜索"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="theme-ink-faint hidden rounded border border-[var(--hairline)] px-1.5 py-0.5 font-mono text-[10px] sm:inline">
                ESC
              </kbd>
            </div>
          </div>

          <div
            ref={listRef}
            className="max-h-[min(60dvh,22rem)] overflow-y-auto overscroll-contain py-1"
            role="listbox"
            aria-label="命令列表"
          >
            {filtered.length === 0 ? (
              <p className="theme-ink-faint px-4 py-8 text-center text-xs tracking-wider">
                无匹配命令
              </p>
            ) : (
              grouped.map(({ group, items: rows }) => (
                <div key={group} className="py-1">
                  <p className="theme-ink-faint px-3 py-1.5 text-[10px] tracking-[0.22em] uppercase">
                    {GROUP_LABEL[group]}
                  </p>
                  {rows.map(({ item, index }) => {
                    const isActive = index === active;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        data-cmd-index={index}
                        data-cursor="pointer"
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                          isActive
                            ? "bg-accent/15 text-accent"
                            : "theme-ink hover:bg-[var(--surface-secondary)]"
                        }`}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => runItem(item)}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {item.label}
                          </span>
                          {item.description ? (
                            <span
                              className={`mt-0.5 block truncate text-[11px] ${
                                isActive ? "text-accent/80" : "theme-ink-faint"
                              }`}
                            >
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                        {item.shortcut ? (
                          <kbd className="theme-ink-faint shrink-0 font-mono text-[10px]">
                            {item.shortcut}
                          </kbd>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="theme-hairline flex items-center justify-between border-t px-3 py-2">
            <p className="theme-ink-faint text-[10px] tracking-wider">
              ↑↓ 选择 · Enter 执行 · {mod}K 开关
            </p>
            <p className="theme-ink-faint font-mono text-[10px]">{filtered.length}</p>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
