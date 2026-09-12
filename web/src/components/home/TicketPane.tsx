"use client";

import { memo } from "react";
import type { Diff, Project, Ticket } from "@/lib/types";
import { formatPrice, isAvailableStatus, isSoldOutStatus } from "@/lib/status";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { TicketSparkline } from "@/components/home/TicketSparkline";

function ticketTone(status: string): BadgeTone {
  if (isAvailableStatus(status)) return "accent";
  if (isSoldOutStatus(status)) return "danger";
  return "default";
}

export const TicketPane = memo(function TicketPane({
  project,
  tickets,
  projects,
  allTickets,
  diffs,
  focusIndex,
  projectTotal,
  userLocked,
  onSelectProject,
  onResumeAutoplay,
}: {
  project: Project | null;
  tickets: Ticket[];
  projects: Project[];
  allTickets: Ticket[];
  diffs: Diff[];
  focusIndex: number;
  projectTotal: number;
  userLocked: boolean;
  onSelectProject: (id: string) => void;
  onResumeAutoplay: () => void;
}) {
  const available = tickets.filter((t) => isAvailableStatus(t.status)).length;

  if (!project) {
    return (
      <p className="theme-ink-faint py-10 text-center text-sm">暂无主展会票档</p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-[var(--hairline)] px-4 py-3 md:px-6">
        <p
          key={project.id}
          className="animate-fade-in-up theme-ink line-clamp-2 text-sm font-medium"
        >
          {project.name}
        </p>
        <p className="theme-ink-faint mt-1 font-mono text-[11px]">
          {available}/{tickets.length} 可售 · #{project.id}
        </p>
        <p className="theme-ink-faint mt-1 truncate text-xs">
          {[project.project_label, project.venue_name].filter(Boolean).join(" · ") ||
            "场地未知"}
        </p>
        <div className="mt-2 flex items-center justify-between font-mono text-[10px] tracking-[0.12em] text-[var(--ink-faint)]">
          <span>
            {String(focusIndex).padStart(2, "0")} / {String(Math.max(projectTotal, 1)).padStart(2, "0")} LIVE
          </span>
          {userLocked ? (
            <button
              type="button"
              onClick={onResumeAutoplay}
              className="text-accent hover:underline"
            >
              恢复轮播
            </button>
          ) : (
            <span>AUTO 8S</span>
          )}
        </div>
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {tickets.length === 0 ? (
          <p className="theme-ink-faint px-5 py-10 text-center text-sm">暂无票档数据</p>
        ) : (
          tickets.map((t) => (
            <div
              key={t.key}
              className="border-b border-[var(--hairline)] px-4 py-3 last:border-b-0 md:px-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="theme-ink truncate text-sm" title={t.name}>
                    {t.name}
                  </p>
                  <p className="theme-ink-faint mt-0.5 font-mono text-[11px]">
                    {formatPrice(t.price)}
                    {t.less_vt >= 0 ? ` · 余 ${t.less_vt}` : ""}
                  </p>
                </div>
                <Badge tone={ticketTone(t.status)}>{t.status}</Badge>
              </div>
              <TicketSparkline ticket={t} diffs={diffs} />
            </div>
          ))
        )}
      </div>
      <div className="shrink-0 border-t border-[var(--hairline)]">
        <p className="px-4 pt-2 font-mono text-[10px] tracking-[0.12em] text-[var(--ink-faint)] uppercase md:px-6">
          watching
        </p>
        <div className="thin-scroll max-h-36 overflow-y-auto">
          {projects.map((p, i) => {
            const list = allTickets.filter((t) => t.project_id === p.id);
            const open = list.filter((t) => isAvailableStatus(t.status)).length;
            const active = p.id === project.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectProject(p.id)}
                className={`flex w-full items-center justify-between gap-3 border-t border-[var(--hairline)] px-4 py-2.5 text-left md:px-6 ${
                  active ? "bg-accent/10" : "hover:bg-[var(--panel-strong)]"
                }`}
              >
                <span className="min-w-0 truncate text-xs">
                  <span className="mr-2 font-mono text-[10px] text-[var(--ink-faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {p.name || p.id}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-[var(--ink-faint)]">
                  {open}/{list.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
