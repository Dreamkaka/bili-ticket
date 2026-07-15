"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatApiUrl, getWsUrl } from "@/lib/api";
import type {
  ConnectionStatus,
  Diff,
  Node,
  Project,
  StockDataPoint,
  Ticket,
} from "@/lib/types";
import {
  nodeEqual,
  projectEqual,
  stabilizeByKey,
  ticketEqual,
} from "@/lib/stable";

const DIFF_LIMIT = 1000;

function enrichDiffs(incoming: Diff[], currentProjects: Project[]): Diff[] {
  if (incoming.length === 0) return incoming;
  const byId = new Map(currentProjects.map((p) => [p.id, p]));

  return incoming.map((item) => {
    const match =
      byId.get(item.ticket_id) ||
      currentProjects.find(
        (p) =>
          p.name &&
          item.ticket_name &&
          (item.ticket_name.includes(p.name) ||
            p.name.includes(item.ticket_name) ||
            (p.venue_name && item.ticket_name.includes(p.venue_name)))
      );
    return {
      ...item,
      project_id: match?.id,
      project_name: match?.name || undefined,
      project_cover: match?.cover || null,
      project_venue: match?.venue_name || null,
    };
  });
}

function toStockPoints(
  items: Array<{ ts: number; less_vt: number; ticket_name?: string }>
): StockDataPoint[] {
  return items
    .filter((d) => d.less_vt >= 0)
    .map((d) => ({
      timestamp: d.ts,
      timeLabel: new Date(d.ts * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      stock: d.less_vt,
      ticketName: d.ticket_name || "未知票档",
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function unpackDiffs(json: unknown): Diff[] {
  if (Array.isArray(json)) return json as Diff[];
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.diffs)) return obj.diffs as Diff[];
    if (Array.isArray(obj.recentDiffs)) return obj.recentDiffs as Diff[];
    if (Array.isArray(obj.data)) {
      const data = obj.data;
      if (Array.isArray(data)) return data as Diff[];
      if (data && typeof data === "object") {
        const inner = data as Record<string, unknown>;
        if (Array.isArray(inner.diffs)) return inner.diffs as Diff[];
        if (Array.isArray(inner.recentDiffs)) return inner.recentDiffs as Diff[];
      }
    }
  }
  return [];
}

function diffKey(d: Diff): string {
  return `${d.id ?? ""}|${d.ts}|${d.ticket_id}|${d.ticket_name}|${d.old_status}|${d.new_status}`;
}

function mergeDiffs(existing: Diff[], incoming: Diff[], limit = DIFF_LIMIT): Diff[] {
  const map = new Map<string, Diff>();
  for (const d of [...incoming, ...existing]) {
    map.set(diffKey(d), d);
  }
  return Array.from(map.values())
    .sort((a, b) => {
      if (b.ts !== a.ts) return b.ts - a.ts;
      return (b.id ?? 0) - (a.id ?? 0);
    })
    .slice(0, limit);
}

async function fetchJson(path: string): Promise<unknown> {
  const url = formatApiUrl(path);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`${path} HTTP ${res.status} (${url})`);
  }
  return res.json();
}

async function fetchDiffsHttp(): Promise<Diff[]> {
  const json = await fetchJson(`/api/diffs?limit=${DIFF_LIMIT}&offset=0`);
  return unpackDiffs(json);
}

async function fetchSnapshotHttp(): Promise<{
  projects: Project[];
  nodes: Node[];
  tickets: Ticket[];
  diffs: Diff[];
} | null> {
  try {
    const json = await fetchJson(`/api/snapshot?limit=${DIFF_LIMIT}`);
    const data = ((json as { data?: unknown })?.data ?? json) as Record<
      string,
      unknown
    >;
    return {
      projects: (data.projects as Project[]) || [],
      nodes: (data.nodes as Node[]) || [],
      tickets: (data.tickets as Ticket[]) || [],
      diffs: unpackDiffs(data),
    };
  } catch (err) {
    console.error("snapshot HTTP failed:", err);
    return null;
  }
}

export function useTelemetry() {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [projects, setProjects] = useState<Project[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [diffs, setDiffs] = useState<Diff[]>([]);
  const [stockHistory, setStockHistory] = useState<StockDataPoint[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  const projectsRef = useRef<Project[]>([]);
  const reconnectDelayRef = useRef(1000);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function applyDiffList(list: Diff[], projectsList: Project[]) {
      if (!active || list.length === 0) return;
      const enriched = enrichDiffs(list, projectsList);
      setDiffs(enriched.slice(0, DIFF_LIMIT));
      setStockHistory(toStockPoints(list).slice(-40));
    }

    async function loadHttpBootstrap() {
      let projectsList: Project[] = [];
      let ticketsList: Ticket[] = [];
      let snapshotDiffs: Diff[] = [];

      // 1) 先拉 snapshot（项目/节点/票档）+ diffs（事件动态）
      //    浏览器默认走同源 /api/*（Next rewrite），避免直连 gateway CORS 失败
      const [snapshot, diffsResult] = await Promise.all([
        fetchSnapshotHttp(),
        fetchDiffsHttp()
          .then((list) => ({ ok: true as const, list }))
          .catch((err) => {
            console.error("diffs HTTP failed:", err);
            return { ok: false as const, list: [] as Diff[] };
          }),
      ]);

      if (!active) return;

      if (snapshot) {
        projectsList = snapshot.projects;
        ticketsList = snapshot.tickets;
        snapshotDiffs = snapshot.diffs;
        setProjects(projectsList);
        setNodes(snapshot.nodes);
        setTickets(ticketsList);
        setLastUpdate(Date.now());
      }

      // 2) 优先用 /api/diffs；失败则回退 snapshot 内 recentDiffs
      const httpDiffs = diffsResult.ok ? diffsResult.list : snapshotDiffs;
      if (httpDiffs.length > 0) {
        applyDiffList(httpDiffs, projectsList);
      } else if (ticketsList.length > 0) {
        const initialHistory = ticketsList
          .filter((t) => t.less_vt >= 0)
          .map((t) => ({
            timestamp: Math.floor(t.last_updated / 1000),
            timeLabel: new Date(t.last_updated).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
            stock: t.less_vt,
            ticketName: t.name || "未知票档",
          }))
          .sort((a, b) => a.timestamp - b.timestamp);
        setStockHistory(initialHistory.slice(-40));
      }
    }

    async function refreshDiffsFromHttp() {
      try {
        const list = await fetchDiffsHttp();
        if (!active || list.length === 0) return;
        const enriched = enrichDiffs(list, projectsRef.current);
        setDiffs((prev) => mergeDiffs(prev, enriched));
        setStockHistory((prev) => {
          const points = toStockPoints(list);
          return [...prev, ...points]
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-40);
        });
        setLastUpdate(Date.now());
      } catch (err) {
        console.error("refresh diffs HTTP failed:", err);
      }
    }

    function connectWebSocket() {
      if (!active) return;
      setConnectionStatus("connecting");

      ws = new WebSocket(getWsUrl());

      ws.onopen = () => {
        if (!active) return;
        setConnectionStatus("connected");
        reconnectDelayRef.current = 1000;
        // 重连后补一次 HTTP diffs，避免只收到增量导致历史空白
        void refreshDiffsFromHttp();
      };

      ws.onmessage = (event) => {
        if (!active) return;
        try {
          const message = JSON.parse(event.data);
          const { type, data } = message;

          if (type === "snapshot") {
            const payload = data || {};
            const nextProjects: Project[] = payload.projects || [];
            if (nextProjects.length) {
              setProjects((prev) => {
                const stable = stabilizeByKey(
                  prev,
                  nextProjects,
                  (p) => p.id,
                  projectEqual
                );
                projectsRef.current = stable;
                return stable;
              });
            }
            if (payload.nodes) {
              setNodes((prev) =>
                stabilizeByKey(prev, payload.nodes as Node[], (n) => n.name, nodeEqual)
              );
            }
            if (payload.tickets) {
              setTickets((prev) =>
                stabilizeByKey(
                  prev,
                  payload.tickets as Ticket[],
                  (t) => t.key,
                  ticketEqual
                )
              );
            }

            const snapDiffs = unpackDiffs(payload);
            if (snapDiffs.length > 0) {
              const enriched = enrichDiffs(
                snapDiffs,
                nextProjects.length ? nextProjects : projectsRef.current
              );
              setDiffs((prev) =>
                prev.length === 0 ? enriched.slice(0, DIFF_LIMIT) : mergeDiffs(prev, enriched)
              );
              setStockHistory((prev) => {
                if (prev.length > 0) return prev;
                return toStockPoints(snapDiffs).slice(-40);
              });
            }
            setLastUpdate(Date.now());
          } else if (type === "status_update") {
            let changed = false;
            const nextProjects = (data.projects || []) as Project[];
            const nextNodes = (data.nodes || []) as Node[];
            const nextTickets = data.tickets
              ? (data.tickets as Ticket[])
              : null;

            setProjects((prev) => {
              const stable = stabilizeByKey(
                prev,
                nextProjects,
                (p) => p.id,
                projectEqual
              );
              if (stable !== prev) changed = true;
              projectsRef.current = stable;
              return stable;
            });
            setNodes((prev) => {
              const stable = stabilizeByKey(
                prev,
                nextNodes,
                (n) => n.name,
                nodeEqual
              );
              if (stable !== prev) changed = true;
              return stable;
            });
            if (nextTickets) {
              setTickets((prev) => {
                const stable = stabilizeByKey(
                  prev,
                  nextTickets,
                  (t) => t.key,
                  ticketEqual
                );
                if (stable !== prev) changed = true;
                return stable;
              });
            }
            // 心跳始终刷新 lastUpdate，供底部进度条；数据引用已稳定时子树可 memo 跳过
            setLastUpdate(Date.now());
            void changed;
          } else if (type === "diff") {
            const incomingDiffs: Diff[] = Array.isArray(data) ? data : [data];

            setDiffs((prev) => {
              const enriched = enrichDiffs(incomingDiffs, projectsRef.current);
              return mergeDiffs(prev, enriched);
            });

            setTickets((prevTickets) => {
              let changed = false;
              const next = prevTickets.map((t) => {
                const match = incomingDiffs.find(
                  (d) => d.ticket_id === t.project_id && d.ticket_name === t.name
                );
                if (!match) return t;
                changed = true;
                return {
                  ...t,
                  status: match.new_status,
                  less_vt: match.less_vt,
                  last_updated: match.ts * 1000,
                };
              });
              return changed ? next : prevTickets;
            });

            setStockHistory((prev) => {
              const validNewPoints = toStockPoints(incomingDiffs);
              return [...prev, ...validNewPoints]
                .sort((a, b) => a.timestamp - b.timestamp)
                .slice(-40);
            });

            setLastUpdate(Date.now());
          }
        } catch (err) {
          console.error("Websocket parsing error:", err);
        }
      };

      ws.onclose = () => {
        if (!active) return;
        setConnectionStatus("disconnected");
        reconnectTimer = setTimeout(() => {
          connectWebSocket();
        }, reconnectDelayRef.current);
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * 1.5,
          10000
        );
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    async function initializeSystem() {
      // 先 HTTP 拉齐事件动态与快照，再挂 WS，减少刷新后事件空白
      await loadHttpBootstrap();
      if (!active) return;
      connectWebSocket();
    }

    void initializeSystem();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  const availableTickets = useMemo(
    () =>
      tickets.filter((t) => {
        const s = t.status;
        return s === "可售" || s.includes("有票") || s.includes("预售中");
      }).length,
    [tickets]
  );

  const onlineNodes = useMemo(
    () => nodes.filter((n) => Date.now() - n.last_heartbeat < 15000).length,
    [nodes, lastUpdate]
  );

  const systemHealthy = useMemo(
    () =>
      connectionStatus === "connected" &&
      (nodes.length === 0 ||
        nodes.every(
          (n) =>
            n.status === "healthy" || Date.now() - n.last_heartbeat < 15000
        )),
    [connectionStatus, nodes, lastUpdate]
  );

  return {
    connectionStatus,
    projects,
    nodes,
    tickets,
    diffs,
    stockHistory,
    lastUpdate,
    availableTickets,
    onlineNodes,
    systemHealthy,
  };
}
