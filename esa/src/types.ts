export type TicketState = {
  key: string;
  name: string;
  status: string;
  price: number;
  saleStart: number;
  saleEnd: number;
  screenName: string;
  subTicketId: number;
  lessVt: number;
};

export type DiffEvent = {
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
};

export type NodeStatus = {
  status: "healthy" | "risk_control" | "error";
  http_code: number;
  message: string;
};

export type TargetsCache = {
  core_ids: string[];
  shard_ids: string[];
  all_ids: string[];
  fetched_at: number;
  stale?: boolean;
};

export type Env = {
  PROBE_STATE?: KVNamespace; // 阿里云 ESA Edge KV 绑定，可选
  GATEWAY_HTTP_URL: string;
  PROBE_TOKEN?: string;
  NODE_NAME?: string;
  PROBE_USER_AGENT?: string;
  SESSDATA?: string;
  CORE_IDS?: string;
  SHARD_IDS?: string;
  TARGETS_TTL_SEC?: string;
  HEARTBEAT_EVERY_N_RUNS?: string;
  MAX_PROJECTS_PER_RUN?: string; // 阿里云 ESA 平台限制单次 fetch 数量，加入分批轮询大小限制
};
