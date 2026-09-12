"use client";

import { memo, type CSSProperties } from "react";
import type { Node } from "@/lib/types";
import {
  formatClock,
  isMonitorRole,
  isNodeAlive,
  isServerlessPrimary,
} from "@/lib/status";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

function nodeState(node: Node): { label: string; tone: BadgeTone } {
  const alive = isNodeAlive(
    node.last_heartbeat,
    Date.now(),
    node.role,
    node.transport,
  );
  const risk =
    node.status === "risk_control" ||
    [412, 403, 429].includes(node.last_http_code);
  const error =
    node.status === "error" || (node.last_http_code !== 200 && !risk);

  if (risk) return { label: "风控", tone: "warning" };
  if (error) return { label: "错误", tone: "danger" };
  if (!alive) return { label: "离线", tone: "default" };
  return { label: "正常", tone: "accent" };
}

function roleMeta(node: Node) {
  if (isMonitorRole(node.role)) {
    return { label: "MONITOR", zh: "辅助监测", tone: "default" as BadgeTone };
  }
  if (isServerlessPrimary(node.role, node.transport)) {
    return {
      label: "PRIMARY",
      zh: "Serverless 主探针",
      tone: "accent" as BadgeTone,
    };
  }
  return { label: "PRIMARY", zh: "主探针", tone: "accent" as BadgeTone };
}

export const NodePanel = memo(function NodePanel({ nodes }: { nodes: Node[] }) {
  if (nodes.length === 0) {
    return (
      <div className="ak-panel theme-ink-faint flex min-h-28 items-center justify-center text-sm">
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
        const serverless = isServerlessPrimary(node.role, node.transport);

        return (
          <div
            key={node.name}
            style={
              {
                "--reveal-delay": `${Math.min(index, 8) * 65 + 100}ms`,
              } as CSSProperties
            }
            className={[
              "reveal-child ak-panel overflow-hidden",
              monitor ? "border-l-2 border-l-[var(--accent)]/40 opacity-95" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="flex items-start justify-between gap-2 p-5 pb-3">
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone={role.tone}>{role.label}</Badge>
                  <span className="theme-ink-faint font-mono text-[10px] tracking-wider">
                    {role.zh}
                  </span>
                </div>
                <p className="theme-ink truncate text-sm font-semibold">
                  {node.name}
                </p>
                <p className="theme-ink-faint mt-0.5 font-mono text-[10px] tracking-wider">
                  HB // {formatClock(node.last_heartbeat)}
                  {monitor || serverless ? " · CRON" : ""}
                </p>
              </div>
              <Badge tone={state.tone} className="shrink-0">
                {state.label}
              </Badge>
            </div>
            <div className="theme-ink-soft space-y-2 px-5 pb-5 text-sm">
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
                <span>{monitor || serverless ? "范围" : "任务"}</span>
                <span className="theme-ink">
                  {monitor
                    ? "全量"
                    : serverless
                      ? "全量冗余"
                      : (node.assigned_project_count ?? 0)}
                </span>
              </div>
              {monitor && (
                <div className="theme-ink-faint font-mono text-[10px] tracking-wide">
                  不参与分片 · 冗余校验
                </div>
              )}
              {serverless && (
                <div className="theme-ink-faint font-mono text-[10px] tracking-wide">
                  与主探针同级 · 不参与分片
                </div>
              )}
              {node.last_error_message && (
                <div className="mt-2 max-h-24 overflow-auto border border-danger/25 bg-danger/10 p-2 font-mono text-[10px] whitespace-pre-wrap text-danger">
                  {node.last_error_message}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});
