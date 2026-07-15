"use client";

import { useEffect, useRef } from "react";
import { toast } from "@heroui/react";
import type { Diff } from "@/lib/types";
import { tagForDiff } from "@/lib/diff";

const MAX_TOASTS_PER_BATCH = 3;

function toastVariant(
  tone: "accent" | "danger" | "default"
): "success" | "danger" | "default" | "accent" {
  if (tone === "accent") return "success";
  if (tone === "danger") return "danger";
  return "default";
}

/**
 * 监听 diffs 增量并弹出 Toast；首包（HTTP/bootstrap）不弹，避免刷新刷屏。
 */
export function useDiffToasts({
  diffs,
  enabled,
  onSelectDiff,
}: {
  diffs: Diff[];
  enabled: boolean;
  onSelectDiff?: (diff: Diff) => void;
}) {
  const seededRef = useRef(false);
  const maxIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      seededRef.current = false;
      maxIdRef.current = 0;
      return;
    }

    const maxId = diffs.reduce((m, d) => Math.max(m, d.id ?? 0), 0);

    if (!seededRef.current) {
      maxIdRef.current = maxId;
      seededRef.current = true;
      return;
    }

    const incoming = diffs
      .filter((d) => (d.id ?? 0) > maxIdRef.current)
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    if (incoming.length === 0) return;

    maxIdRef.current = Math.max(
      maxIdRef.current,
      ...incoming.map((d) => d.id ?? 0)
    );

    if (incoming.length > MAX_TOASTS_PER_BATCH) {
      const first = incoming[incoming.length - 1]!;
      toast(`${incoming.length} 条票务变动`, {
        description: first.ticket_name,
        variant: "accent",
        timeout: 4500,
        actionProps: {
          children: "查看",
          onPress: () => onSelectDiff?.(first),
        },
      });
      return;
    }

    for (const diff of incoming) {
      const tag = tagForDiff(diff);
      toast(`${tag.label} · ${diff.ticket_name}`, {
        description: [
          diff.project_name,
          `${diff.old_status} → ${diff.new_status}`,
          diff.less_vt >= 0 ? `余 ${diff.less_vt}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        variant: toastVariant(tag.tone),
        timeout: 4500,
        actionProps: {
          children: "聚焦",
          onPress: () => onSelectDiff?.(diff),
        },
      });
    }
  }, [diffs, enabled, onSelectDiff]);
}
