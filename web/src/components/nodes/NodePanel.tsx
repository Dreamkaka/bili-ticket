"use client";

import { memo, type CSSProperties } from "react";
import { Card, Chip } from "@heroui/react";
import type { Node } from "@/lib/types";
import { formatClock, isNodeAlive } from "@/lib/status";

function nodeState(node: Node) {
  const alive = isNodeAlive(node.last_heartbeat);
  const risk =
    node.status === "risk_control" || [412, 403, 429].includes(node.last_http_code);
  const error = node.status === "error" || (node.last_http_code !== 200 && !risk);

  if (risk) return { label: "风控", color: "warning" as const };
  if (error) return { label: "错误", color: "danger" as const };
  if (!alive) return { label: "离线", color: "default" as const };
  return { label: "正常", color: "accent" as const };
}

export const NodePanel = memo(function NodePanel({ nodes }: { nodes: Node[] }) {
  if (nodes.length === 0) {
    return (
      <div className="theme-panel theme-ink-faint flex min-h-28 items-center justify-center border text-sm">
        暂无采集节点
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {nodes.map((node, index) => {
        const state = nodeState(node);
        return (
          <Card
            key={node.name}
            style={{ "--reveal-delay": `${Math.min(index, 8) * 65 + 100}ms` } as CSSProperties}
            className="reveal-child ui-panel theme-panel rounded-none border border-[var(--hairline)] shadow-none"
          >
            <Card.Header className="flex items-start justify-between gap-2 p-5 pb-3">
              <div>
                <Card.Title className="theme-ink text-sm font-semibold">{node.name}</Card.Title>
                <Card.Description className="theme-ink-faint font-mono text-[10px] tracking-wider">
                  HB // {formatClock(node.last_heartbeat)}
                </Card.Description>
              </div>
              <Chip size="sm" variant="soft" color={state.color} className="rounded-sm">
                {state.label}
              </Chip>
            </Card.Header>
            <Card.Content className="theme-ink-soft space-y-2 px-5 pb-5 text-sm">
              <div className="flex justify-between">
                <span>HTTP</span>
                <span
                  className={
                    node.last_http_code === 200 ? "text-accent" : "font-medium text-danger"
                  }
                >
                  {node.last_http_code}
                </span>
              </div>
              <div className="flex justify-between">
                <span>任务</span>
                <span className="theme-ink">{node.assigned_project_count ?? 0}</span>
              </div>
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
