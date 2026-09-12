"use client";

import { memo, useMemo, useState, type CSSProperties } from "react";
import type { Project, Ticket } from "@/lib/types";
import { formatPrice, isAvailableStatus, isSoldOutStatus } from "@/lib/status";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

function ticketTone(status: string): BadgeTone {
  if (isAvailableStatus(status)) return "accent";
  if (isSoldOutStatus(status)) return "danger";
  return "default";
}

const ProjectCard = memo(function ProjectCard({
  project,
  projectTickets,
  highlighted,
  isOpen,
  onToggle,
  index,
}: {
  project: Project;
  projectTickets: Ticket[];
  highlighted: boolean;
  isOpen: boolean;
  onToggle: (id: string, open: boolean) => void;
  index: number;
}) {
  const availableCount = useMemo(
    () => projectTickets.filter((t) => isAvailableStatus(t.status)).length,
    [projectTickets]
  );

  return (
    <div
      id={`project-${project.id}`}
      data-project-id={project.id}
      style={{ "--reveal-delay": `${Math.min(index, 8) * 55 + 100}ms` } as CSSProperties}
      className={`reveal-child ak-panel min-w-0 overflow-hidden ${
        highlighted
          ? "border-accent/60 ring-2 ring-accent/30"
          : "hover:border-accent/30"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Badge tone="accent" className="uppercase">
              {project.type}
            </Badge>
            <span className="theme-ink-faint min-w-0 truncate font-mono text-[10px]">
              #{project.id}
            </span>
          </div>
          <h3
            className="theme-ink mt-2 line-clamp-2 text-base leading-snug font-semibold break-all"
            title={project.name || undefined}
          >
            {project.name || "加载中…"}
          </h3>
          <p
            className="theme-ink-faint mt-1 truncate text-sm"
            title={
              [project.project_label, project.venue_name]
                .filter(Boolean)
                .join(" · ") || undefined
            }
          >
            {[project.project_label, project.venue_name]
              .filter(Boolean)
              .join(" · ") || "场地未知"}
          </p>
        </div>
        {project.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.cover}
            alt=""
            loading="lazy"
            decoding="async"
            width={48}
            height={64}
            className="h-16 w-12 shrink-0 object-cover ring-1 ring-[var(--hairline)]"
            referrerPolicy="no-referrer"
          />
        )}
      </div>

      <div className="space-y-3 px-4 pb-4 sm:px-5">
        <div className="flex items-center justify-between text-sm">
          <span className="theme-ink-faint">票档状态</span>
          <span className="font-medium text-accent">
            {availableCount}/{projectTickets.length} 可售
          </span>
        </div>

        {projectTickets.length === 0 ? (
          <p className="theme-ink-faint text-sm">暂无票档数据</p>
        ) : isOpen ? (
          <div className="flex flex-col gap-1.5">
            {projectTickets.map((t, i) => (
              <div
                key={t.key}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                className="stagger-item ak-panel-strong flex min-h-11 min-w-0 flex-col gap-1.5 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <span
                  className="theme-ink min-w-0 truncate sm:flex-1 sm:pr-2"
                  title={t.name}
                >
                  {t.name}
                </span>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="theme-ink font-medium">{formatPrice(t.price)}</span>
                  {t.less_vt >= 0 && (
                    <span className="theme-ink-faint text-xs">
                      余{" "}
                      <strong className={t.less_vt > 0 ? "text-accent" : "theme-ink-faint"}>
                        {t.less_vt}
                      </strong>
                    </span>
                  )}
                  <Badge tone={ticketTone(t.status)}>{t.status}</Badge>
                </div>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onToggle(project.id, false)}
            >
              收起
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => onToggle(project.id, true)}
          >
            查看 {projectTickets.length} 个票档 ›
          </Button>
        )}
      </div>

      <div className="theme-hairline theme-ink-faint flex justify-between border-t px-5 py-3 font-mono text-[10px] tracking-wider">
        <span>NODE // {project.assigned_node || "NONE"}</span>
      </div>
    </div>
  );
});

export const ProjectGrid = memo(function ProjectGrid({
  projects,
  tickets,
  highlightId,
}: {
  projects: Project[];
  tickets: Ticket[];
  highlightId?: string | null;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const ticketsByProject = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    for (const t of tickets) {
      const list = map.get(t.project_id);
      if (list) list.push(t);
      else map.set(t.project_id, [t]);
    }
    return map;
  }, [tickets]);

  const onToggle = (id: string, open: boolean) => {
    setExpanded((prev) => ({ ...prev, [id]: open }));
  };

  if (projects.length === 0) {
    return (
      <div className="ak-panel theme-ink-faint flex min-h-40 items-center justify-center text-sm">
        暂无监控项目
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {projects.map((project, index) => (
        <ProjectCard
          key={project.id}
          project={project}
          projectTickets={ticketsByProject.get(project.id) ?? []}
          highlighted={highlightId === project.id}
          isOpen={!!expanded[project.id]}
          onToggle={onToggle}
          index={index}
        />
      ))}
    </div>
  );
});
