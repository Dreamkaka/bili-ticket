export interface TicketState {
  key: string;
  name: string;
  status: string;
  price: number;
  saleStart: number;
  saleEnd: number;
  screenName: string;
  subTicketId: number;
  lessVt: number;
}

export interface DiffEvent {
  ticket_id: string;
  key: string;
  name: string;
  old_status: string;
  new_status: string;
  ts: number;
  price: number;
  sale_start: number;
  sale_end: number;
  screen_name: string;
  sub_ticket_id: number;
  less_vt: number;
}

export interface NodeStatus {
  status: "healthy" | "risk_control" | "error";
  http_code: number;
  message: string;
}

export interface TargetsCache {
  core_ids: string[];
  shard_ids: string[];
  all_ids: string[];
  fetched_at: number;
  stale?: boolean;
}

export interface Env {
  GATEWAY_HTTP_URL: string;
  PROBE_TOKEN?: string;
  NODE_NAME?: string;
  PROBE_USER_AGENT?: string;
  SESSDATA?: string;
  CORE_IDS?: string;
  SHARD_IDS?: string;
  TARGETS_TTL_SEC?: string;
  HEARTBEAT_EVERY_N_RUNS?: string;
  MAX_CONCURRENCY?: string;
}
