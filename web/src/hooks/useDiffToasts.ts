"use client";

import { useEffect, useRef } from "react";
import type { Diff } from "@/lib/types";
import { tagForDiff } from "@/lib/diff";
import { useToast, type ToastTone } from "@/components/ui/Toast";

const MAX_TOASTS_PER_BATCH = 3;
const SEED_KEY = "ticket-diff-toast-max-id";

function toastTone(tone: "accent" | "danger" | "default"): ToastTone {
  if (tone === "accent") return "success";
  if (tone === "danger") return "danger";
  return "default";
}

function readSeed(): number {
  try {
    const raw = sessionStorage.getItem(SEED_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeSeed(id: number) {
  try {
    sessionStorage.setItem(SEED_KEY, String(id));
  } catch {
    /* ignore */
  }
}

/**
 * 监听 diffs 增量并弹出 Toast；首包与回首页重挂载不弹。
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
  const { push } = useToast();
  const seededRef = useRef(false);
  const maxIdRef = useRef(0);
  const pushRef = useRef(push);
  const onSelectRef = useRef(onSelectDiff);
  pushRef.current = push;
  onSelectRef.current = onSelectDiff;

  useEffect(() => {
    if (!enabled || diffs.length === 0) return;

    const maxId = diffs.reduce((m, d) => Math.max(m, d.id ?? 0), 0);

    if (!seededRef.current) {
      const stored = readSeed();
      maxIdRef.current = Math.max(stored, maxId);
      writeSeed(maxIdRef.current);
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
    writeSeed(maxIdRef.current);

    if (incoming.length > MAX_TOASTS_PER_BATCH) {
      const first = incoming[incoming.length - 1]!;
      pushRef.current({
        title: `${incoming.length} 条票务变动`,
        description: first.ticket_name,
        tone: "accent",
        timeout: 4500,
        action: {
          label: "查看",
          onClick: () => onSelectRef.current?.(first),
        },
      });
      return;
    }

    for (const diff of incoming) {
      const tag = tagForDiff(diff);
      pushRef.current({
        title: `${tag.label} · ${diff.ticket_name}`,
        description: [
          diff.project_name,
          `${diff.old_status} → ${diff.new_status}`,
          diff.less_vt >= 0 ? `余 ${diff.less_vt}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        tone: toastTone(tag.tone),
        timeout: 4500,
        action: {
          label: "查看",
          onClick: () => onSelectRef.current?.(diff),
        },
      });
    }
  }, [diffs, enabled]);
}
