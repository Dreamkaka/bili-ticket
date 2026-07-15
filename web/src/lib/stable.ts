/** 浅比较数组：长度 + 每项 id/关键字段；相同则返回 prev 引用 */
export function stabilizeByKey<T>(
  prev: T[],
  next: T[],
  keyOf: (item: T) => string,
  equal: (a: T, b: T) => boolean = () => true
): T[] {
  if (prev === next) return prev;
  if (prev.length !== next.length) return next;

  const prevMap = new Map(prev.map((item) => [keyOf(item), item]));
  for (const item of next) {
    const old = prevMap.get(keyOf(item));
    if (!old || !equal(old, item)) return next;
  }
  return prev;
}

export function projectEqual(
  a: {
    id: string;
    name: string | null;
    cover: string | null;
    venue_name: string | null;
    project_label: string | null;
    type: string;
    assigned_node: string | null;
  },
  b: typeof a
): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.cover === b.cover &&
    a.venue_name === b.venue_name &&
    a.project_label === b.project_label &&
    a.type === b.type &&
    a.assigned_node === b.assigned_node
  );
}

export function nodeEqual(
  a: {
    name: string;
    status: string;
    last_http_code: number;
    last_error_message: string | null;
    last_heartbeat: number;
    assigned_project_count?: number;
  },
  b: typeof a
): boolean {
  return (
    a.name === b.name &&
    a.status === b.status &&
    a.last_http_code === b.last_http_code &&
    a.last_error_message === b.last_error_message &&
    a.last_heartbeat === b.last_heartbeat &&
    a.assigned_project_count === b.assigned_project_count
  );
}

export function ticketEqual(
  a: {
    key: string;
    project_id: string;
    status: string;
    less_vt: number;
    price: number;
    name: string;
    last_updated: number;
  },
  b: typeof a
): boolean {
  return (
    a.key === b.key &&
    a.project_id === b.project_id &&
    a.status === b.status &&
    a.less_vt === b.less_vt &&
    a.price === b.price &&
    a.name === b.name &&
    a.last_updated === b.last_updated
  );
}
