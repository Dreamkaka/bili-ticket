"use client";

import { memo, type CSSProperties } from "react";
import { Card, Chip } from "@heroui/react";
import type { Node } from "@/lib/types";
import { formatClock, isMonitorRole, isNodeAlive } from "@/lib/status";

function nodeState(node: Node) {
  const alive = isNodeAlive(node.last_heartbeat, Date.now(), node.role);
  const risk =
    node.status === "risk_control" ||
    [412, 403, 429].includes(node.last_http_code);
  const error =
    node.status === "error" || (node.last_http_code !== 200 && !risk);

  if (risk) return { label: "风控", color: "warning" as const };
  if (error) return { label: "错误", color: "danger" as const };
  if (!alive) return { label: "离线", color: "default" as const };
  return { label: "正常", color: "accent" as const };
}

function roleMeta(node: Node) {
  if (isMonitorRole(node.role)) {
    return {
      label: "MONITOR",
      zh: "辅助监测",
      color: "default" as const,
    };
  }
  return {
    label: "PRIMARY",
    zh: "主探针",
    color: "accent" as const,
  };
}

export const NodePanel = memo(function NodePanel({ nodes }: { nodes: Node[] }) {
  if (nodes.length === 0) {
    return (
      <div className="theme-panel theme-ink-faint flex min-h-28 items-center justify-center border text-sm">
        暂无采集节点
      </div>
    );
  }

  // 主探针在前，辅助监测在后
  const ordered = [...nodes].sort((a, b) => {
    const am = isMonitorRole(a.role) ? 1 : 0;
    const bm = isMonitorRole(b.role) ? 1 : 0;
    if (am !== bm) return am - bm;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {ordered.map((node, index) => {
        const state = nodeState(node);
        const role = roleMeta(node);
        const monitor = isMonitorRole(node.role);

        return (
          <Card
            key={node.name}
            style={
              {
                "--reveal-delay": `${Math.min(index, 8) * 65 + 100}ms`,
              } as CSSProperties
            }
            className={[
              "reveal-child ui-panel theme-panel rounded-none border border-[var(--hairline)] shadow-none",
              monitor ? "border-l-2 border-l-[var(--accent)]/40 opacity-95" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <Card.Header className="flex items-start justify-between gap-2 p-5 pb-3">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <Chip
                    size="sm"
                    variant="soft"
                    color={role.color}
                    className="rounded-sm"
                  >
                    {role.label}
                  </Chip>
                  <span className="theme-ink-faint font-mono text-[10px] tracking-wider">
                    {role.zh}
                  </span>
                </div>
                <Card.Title className="theme-ink truncate text-sm font-semibold">
                  {node.name}
                </Card.Title>
                <Card.Description className="theme-ink-faint font-mono text-[10px] tracking-wider">
                  HB // {formatClock(node.last_heartbeat)}
                  {monitor ? " · CRON" : ""}
                </Card.Description>
              </div>
              <Chip
                size="sm"
                variant="soft"
                color={state.color}
                className="shrink-0 rounded-sm"
              >
                {state.label}
              </Chip>
            </Card.Header>
            <Card.Content className="theme-ink-soft space-y-2 px-5 pb-5 text-sm">
              <div className="flex justify-between">
                <span>HTTP</span>
                <span
                  className={
                    node.last_http_code === 200
                      ? "text-accent"
                      : "font-medium text-danger"
                  }
                >
                  {node.last_http_code}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{monitor ? "范围" : "任务"}</span>
                <span className="theme-ink">
                  {monitor
                    ? "全量"
                    : (node.assigned_project_count ?? 0)}
                </span>
              </div>
              {monitor && (
                <div className="theme-ink-faint font-mono text-[10px] tracking-wide">
                  不参与分片 · 冗余校验
                </div>
              )}
              {node.last_error_message && (
                <div className="mt-2 overflow-x-auto border border-danger/25 bg-danger/10 p-2 font-mono text-[10px] text-danger whitespace-pre-wrap">
                  {node.last_error_message}
                </div>
              )}
            </Card.Content>
          </Card>
        );
      })}
    </div>
  );
});
