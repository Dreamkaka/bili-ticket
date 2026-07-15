import type { DiffEvent, TicketState } from "./types";

export function diffStates(
  projectId: string,
  oldS: Map<string, TicketState>,
  newS: Map<string, TicketState>,
): DiffEvent[] {
  const out: DiffEvent[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (const [key, ns] of newS) {
    const old = oldS.get(key);
    if (!old) {
      out.push({
        ticket_id: projectId,
        key,
        name: ns.name,
        old_status: "",
        new_status: ns.status,
        ts: now,
        price: ns.price,
        sale_start: ns.saleStart,
        sale_end: ns.saleEnd,
        screen_name: ns.screenName,
        sub_ticket_id: ns.subTicketId,
        less_vt: ns.lessVt,
      });
      continue;
    }
    if (old.status !== ns.status || old.lessVt !== ns.lessVt) {
      out.push({
        ticket_id: projectId,
        key,
        name: ns.name,
        old_status: old.status,
        new_status: ns.status,
        ts: now,
        price: ns.price,
        sale_start: ns.saleStart,
        sale_end: ns.saleEnd,
        screen_name: ns.screenName,
        sub_ticket_id: ns.subTicketId,
        less_vt: ns.lessVt,
      });
    }
  }

  for (const [key, old] of oldS) {
    if (!newS.has(key)) {
      out.push({
        ticket_id: projectId,
        key,
        name: old.name,
        old_status: old.status,
        new_status: "removed",
        ts: now,
        price: old.price,
        sale_start: old.saleStart,
        sale_end: old.saleEnd,
        screen_name: old.screenName,
        sub_ticket_id: old.subTicketId,
        less_vt: -1,
      });
    }
  }

  return out;
}

export function statesToRecord(
  states: Map<string, TicketState>,
): Record<string, TicketState> {
  const out: Record<string, TicketState> = {};
  for (const [k, v] of states) out[k] = v;
  return out;
}

export function recordToStates(
  record: Record<string, TicketState> | null | undefined,
): Map<string, TicketState> {
  const map = new Map<string, TicketState>();
  if (!record) return map;
  for (const [k, v] of Object.entries(record)) map.set(k, v);
  return map;
}
