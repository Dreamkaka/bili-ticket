"use client";

import { memo, useMemo } from "react";
import type { Diff, Ticket } from "@/lib/types";
import { isAvailableStatus } from "@/lib/status";

const SLOT_COUNT = 16;

type Sample = { ts: number; value: number; available: boolean };

function samplesForTicket(ticket: Ticket, diffs: Diff[]): Sample[] {
  const related = diffs
    .filter(
      (d) =>
        (d.ticket_id === ticket.project_id || d.project_id === ticket.project_id) &&
        d.ticket_name === ticket.name
    )
    .slice()
    .sort((a, b) => a.ts - b.ts);

  const points: Sample[] = related.map((d) => ({
    ts: d.ts,
    value: d.less_vt >= 0 ? d.less_vt : isAvailableStatus(d.new_status) ? 1 : 0,
    available: isAvailableStatus(d.new_status),
  }));

  const nowTs = ticket.last_updated
    ? ticket.last_updated > 1e12
      ? Math.floor(ticket.last_updated / 1000)
      : ticket.last_updated
    : Math.floor(Date.now() / 1000);

  points.push({
    ts: nowTs,
    value: ticket.less_vt >= 0 ? ticket.less_vt : isAvailableStatus(ticket.status) ? 1 : 0,
    available: isAvailableStatus(ticket.status),
  });

  return points;
}

function toSlots(samples: Sample[]): Array<Sample | null> {
  if (samples.length === 0) return [];
  if (samples.length === 1) {
    const slots: Array<Sample | null> = Array.from({ length: SLOT_COUNT }, () => null);
    slots[SLOT_COUNT - 1] = samples[0]!;
    return slots;
  }
  const start = samples[0]!.ts;
  const end = Math.max(samples[samples.length - 1]!.ts, start + 1);
  const span = end - start;
  const slots: Array<Sample | null> = Array.from({ length: SLOT_COUNT }, () => null);
  for (const sample of samples) {
    const idx = Math.min(
      SLOT_COUNT - 1,
      Math.round(((sample.ts - start) / span) * (SLOT_COUNT - 1))
    );
    const prev = slots[idx];
    if (!prev || sample.ts >= prev.ts) slots[idx] = sample;
  }
  let last: Sample | null = null;
  return slots.map((slot) => {
    if (slot) {
      last = slot;
      return slot;
    }
    return last;
  });
}

export const TicketSparkline = memo(function TicketSparkline({
  ticket,
  diffs,
}: {
  ticket: Ticket;
  diffs: Diff[];
}) {
  const slots = useMemo(() => toSlots(samplesForTicket(ticket, diffs)), [ticket, diffs]);
  const max = Math.max(1, ...slots.map((s) => s?.value ?? 0));

  if (slots.every((s) => s == null)) return null;

  return (
    <div
      className="mt-2 flex h-5 items-end gap-px"
      title="库存 / 可售状态随时间变化"
      aria-hidden
    >
      {slots.map((s, i) => {
        if (!s) {
          return (
            <span
              key={`empty-${i}`}
              className="min-w-0 flex-1 bg-[var(--hairline)]"
              style={{ height: "12%" }}
            />
          );
        }
        const h = Math.max(18, Math.round((s.value / max) * 100));
        return (
          <span
            key={`${s.ts}-${i}`}
            className={`min-w-0 flex-1 ${
              s.available
                ? "bg-accent/80"
                : s.value > 0
                  ? "bg-[var(--ink-faint)]/55"
                  : "bg-[var(--hairline)]"
            }`}
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
});
