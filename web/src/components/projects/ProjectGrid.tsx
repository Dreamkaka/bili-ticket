"use client";

import { memo, useMemo, useState, type CSSProperties } from "react";
import { Button, Card, Chip } from "@heroui/react";
import type { Project, Ticket } from "@/lib/types";
import { formatPrice, isAvailableStatus, isSoldOutStatus } from "@/lib/status";

function ticketChipColor(status: string): "accent" | "danger" | "default" {
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
    <Card
      id={`project-${project.id}`}
      data-project-id={project.id}
      style={{ "--reveal-delay": `${Math.min(index, 8) * 55 + 100}ms` } as CSSProperties}
      className={`reveal-child ui-panel theme-panel min-w-0 overflow-hidden rounded-none border shadow-none ${
        highlighted
          ? "border-accent/50 ring-1 ring-accent/30"
          : "border-[var(--hairline)] hover:border-accent/30"
      }`}
    >
      <Card.Header className="flex min-w-0 items-start gap-3 overflow-hidden p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-accent uppercase">
              {project.type}
            </span>
            <span className="theme-ink-faint min-w-0 truncate font-mono text-[10px]">
              #{project.id}
            </span>
          </div>
          <Card.Title
            className="theme-ink mt-2 line-clamp-2 break-all text-base font-semibold leading-snug"
            title={project.name || undefined}
          >
            {project.name || "加载中…"}
          </Card.Title>
          <Card.Description
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
          </Card.Description>
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
            className="h-16 w-12 shrink-0 self-start object-cover ring-1 ring-[var(--hairline)]"
            referrerPolicy="no-referrer"
          />
        )}
      </Card.Header>

      <Card.Content className="space-y-3 px-4 pb-4 sm:px-5">
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
                className="stagger-item theme-panel-strong flex min-h-11 min-w-0 flex-col gap-1.5 border border-[var(--hairline)] px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
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
                  <Chip
                    size="sm"
                    variant="soft"
                    color={ticketChipColor(t.status)}
                    className="rounded-sm"
                  >
                    {t.status}
                  </Chip>
                </div>
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="min-h-10 w-full rounded-none"
              onPress={() => onToggle(project.id, false)}
            >
              收起
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="min-h-10 w-full rounded-none border border-[var(--hairline)]"
            onPress={() => onToggle(project.id, true)}
          >
            查看 {projectTickets.length} 个票档 ›
          </Button>
        )}
      </Card.Content>

      <Card.Footer className="theme-hairline theme-ink-faint flex justify-between border-t px-5 py-3 font-mono text-[10px] tracking-wider">
        <span>NODE // {project.assigned_node || "NONE"}</span>
      </Card.Footer>
    </Card>
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
      <div className="theme-panel theme-ink-faint flex min-h-40 items-center justify-center border text-sm">
        暂无监控项目
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
