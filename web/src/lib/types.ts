export interface Project {
  id: string;
  type: "core" | "shard";
  assigned_node: string | null;
  name: string | null;
  venue_name: string | null;
  cover: string | null;
  /** 展会/演出举办时间标签，来自 B 站 project_label */
  project_label: string | null;
}

export interface Node {
  name: string;
  status: string;
  last_http_code: number;
  last_error_message: string | null;
  last_heartbeat: number;
  assigned_project_count?: number;
}

export interface Ticket {
  project_id: string;
  sub_ticket_id: number;
  key: string;
  name: string;
  status: string;
  price: number;
  less_vt: number;
  last_updated: number;
}

export interface Diff {
  id: number;
  ticket_id: string;
  ticket_name: string;
  old_status: string;
  new_status: string;
  ts: number;
  less_vt: number;
  project_id?: string;
  project_name?: string;
  project_cover?: string | null;
  project_venue?: string | null;
}

export interface StockDataPoint {
  timestamp: number;
  timeLabel: string;
  stock: number;
  ticketName: string;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";
