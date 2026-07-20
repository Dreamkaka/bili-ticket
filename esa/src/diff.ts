import type { DiffEvent, TicketState } from "./types";

/**
 * 将 Map 转为普通的键值记录，方便序列化为 JSON 写入 KV
 */
export function statesToRecord(
  states: Map<string, TicketState>,
): Record<string, TicketState> {
  const record: Record<string, TicketState> = {};
  for (const [k, v] of states.entries()) {
    record[k] = v;
  }
  return record;
}

/**
 * 将普通键值记录转回 Map
 */
export function recordToStates(
  record: Record<string, TicketState> | null | undefined,
): Map<string, TicketState> {
  const map = new Map<string, TicketState>();
  if (record) {
    for (const [k, v] of Object.entries(record)) {
      map.set(k, v);
    }
  }
  return map;
}

/**
 * 比对某项目场次票种的新旧状态，产生变更事件
 */
export function diffStates(
  projectId: string,
  oldStates: Map<string, TicketState>,
  newStates: Map<string, TicketState>,
): DiffEvent[] {
  const diffs: DiffEvent[] = [];
  const now = Date.now();

  for (const [key, newVal] of newStates.entries()) {
    const oldVal = oldStates.get(key);

    if (!oldVal) {
      // 首次录入的增量，或者新出现的票种不作为变更触发（防止首次启动报警轰炸），直接跳过
      continue;
    }

    const hasStatusChanged = oldVal.status !== newVal.status;
    const hasPriceChanged = oldVal.price !== newVal.price;
    const hasVtChanged = oldVal.lessVt !== newVal.lessVt;

    if (hasStatusChanged || hasPriceChanged || hasVtChanged) {
      diffs.push({
        ticket_id: projectId,
        key: newVal.key,
        name: newVal.name,
        old_status: oldVal.status,
        new_status: newVal.status,
        ts: now,
        price: newVal.price,
        sale_start: newVal.saleStart,
        sale_end: newVal.saleEnd,
        screen_name: newVal.screenName,
        sub_ticket_id: newVal.subTicketId,
        less_vt: newVal.lessVt,
      });
    }
  }

  return diffs;
}
