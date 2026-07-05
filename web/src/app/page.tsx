"use client";

import { useEffect, useState, useRef } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

// ==========================================
// 基础路径环境变量导入及防御性格式化函数
// ==========================================
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";

const formatApiUrl = (path: string): string => {
  if (!BASE_URL) return path; 
  
  let normalized = BASE_URL.trim();
  if (!/^https?:\/\//i.test(normalized) && !normalized.startsWith("/")) {
    normalized = "http://" + normalized;
  }
  
  const baseClean = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  const pathClean = path.startsWith("/") ? path : "/" + path;
  
  return `${baseClean}${pathClean}`;
};

// ==========================================
// 自定义图片背景配置
// ==========================================
const BACKGROUND_CONFIG = {
  imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2560&auto=format&fit=crop", 
  opacity: 0.25,      
  blurAmount: "8px",  
};

interface Project {
  id: string;
  type: "core" | "shard";
  assigned_node: string | null;
  name: string | null;
  venue_name: string | null;
  cover: string | null;
}

interface Node {
  name: string;
  status: string;
  last_http_code: number;
  last_error_message: string | null;
  last_heartbeat: number;
  assigned_project_count?: number;
}

interface Ticket {
  project_id: string;
  sub_ticket_id: number;
  key: string;
  name: string;
  status: string;
  price: number;
  less_vt: number;
  last_updated: number;
}

interface Diff {
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

interface StockDataPoint {
  timestamp: number;
  timeLabel: string;
  stock: number;
  ticketName: string;
}

export default function Home() {
  // ==========================================
  // 统一规范的 React 状态声明区（置于组件最顶部）
  // ==========================================
  const [activeTab, setActiveTab] = useState<"sales" | "events" | "nodes">("sales");
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [projects, setProjects] = useState<Project[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [diffs, setDiffs] = useState<Diff[]>([]);
  const [stockHistory, setStockHistory] = useState<StockDataPoint[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [fadeBoot, setFadeBoot] = useState(false); 
  const [bootLogs, setBootLogs] = useState<string[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef<number>(1000);
  const projectsRef = useRef<Project[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 模拟终端开机引导序列
  useEffect(() => {
    const sequence = [
      "LOADING TELEMETRY HARNESS SYSTEM...",
      "INITIALIZING NETWORK INGEST CAPABILITY...",
      "HTTP SNAPSHOT & LOGS CHANNELS TARGETED // OK",
      "ESTABLISHING METADATA SCHEDULERS...",
      "DATAPACKET PIPELINE RESOLVED // ACTIVE",
    ];
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < sequence.length) {
        setBootLogs((prev) => [...prev, sequence[currentIndex]!]);
        currentIndex++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setFadeBoot(true);
          setTimeout(() => {
            setIsBooting(false);
          }, 500); 
        }, 500);
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const getStatusClasses = (status: string) => {
    if (status === "可售" || status.includes("有票") || status.includes("预售中")) {
      return "bg-emerald-950/20 text-emerald-400 border-emerald-900/50";
    }
    if (status === "已售罄" || status.includes("无票") || status.includes("售罄") || status.includes("不能买")) {
      return "bg-rose-950/20 text-rose-400 border-rose-900/50";
    }
    return "bg-transparent text-zinc-500 border-zinc-900";
  };

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const enrichDiffs = (incoming: Diff[], currentProjects: Project[]): Diff[] => {
    return incoming.map((item) => {
      const match = currentProjects.find((p) => p.id === item.ticket_id) ||
                    currentProjects.find(
                      (p) =>
                        p.name && item.ticket_name &&
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
  };

  // 统一的 HTTP 初始化与 WS 机制
  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;

    async function initializeSystem() {
      let currentProjectsList: Project[] = [];
      let fetchedDiffsList: Diff[] = [];
      let fetchedTicketsList: Ticket[] = [];

      try {
        const [snapshotRes, diffsRes] = await Promise.all([
          fetch(formatApiUrl("/api/snapshot")).catch(() => null),
          fetch(formatApiUrl("/api/diffs")).catch(() => null)
        ]);

        // 1. 处理 Snapshot 数据
        if (snapshotRes && snapshotRes.ok) {
          const json = await snapshotRes.json();
          const data = json.data || json;

          if (active) {
            currentProjectsList = data.projects || [];
            setProjects(currentProjectsList);
            setNodes(data.nodes || []);
            
            fetchedTicketsList = data.tickets || [];
            setTickets(fetchedTicketsList);
            setLastUpdate(Date.now());
          }
        }

        // 2. 处理 Diffs 历史数据与曲线图种子数据
        if (diffsRes && diffsRes.ok) {
          const json = await diffsRes.json();

          // 核心修复：多格式智能解包，保证不管后端如何包装字段，均能正确提取 diff 数组
          if (Array.isArray(json)) {
            fetchedDiffsList = json;
          } else if (json && Array.isArray(json.diffs)) {
            fetchedDiffsList = json.diffs;
          } else if (json && Array.isArray(json.recentDiffs)) {
            fetchedDiffsList = json.recentDiffs;
          } else if (json && Array.isArray(json.data)) {
            fetchedDiffsList = json.data;
          } else {
            fetchedDiffsList = [];
          }

          if (active) {
            const enriched = enrichDiffs(fetchedDiffsList, currentProjectsList);
            setDiffs(enriched.slice(0, 100));

            const historyPoints = fetchedDiffsList
              .filter((d) => d.less_vt >= 0)
              .map((d) => ({
                timestamp: d.ts,
                timeLabel: new Date(d.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                stock: d.less_vt,
                ticketName: d.ticket_name || "未知票档"
              }))
              .sort((a, b) => a.timestamp - b.timestamp);

            setStockHistory(historyPoints.slice(-40));
          }
        } else if (active && fetchedTicketsList.length > 0) {
          const initialHistory = fetchedTicketsList
            .filter((t) => t.less_vt >= 0)
            .map((t) => ({
              timestamp: Math.floor(t.last_updated / 1000),
              timeLabel: new Date(t.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              stock: t.less_vt,
              ticketName: t.name || "未知票档"
            }))
            .sort((a, b) => a.timestamp - b.timestamp);

          setStockHistory(initialHistory.slice(-40));
        }
      } catch (err) {
        console.error("HTTP initial telemetry datasets load failed:", err);
      }

      // ------------------------------------------
      // 3. 开始长连接 WebSocket 数据订阅
      // ------------------------------------------
      function connectWebSocket() {
        if (!active) return;
        setConnectionStatus("connecting");

        let wsUrl = "";
        if (BASE_URL) {
          let normalized = BASE_URL.trim();
          if (!/^https?:\/\//i.test(normalized) && !normalized.startsWith("/")) {
            normalized = "http://" + normalized;
          }
          wsUrl = normalized.replace(/^http/, "ws") + "/ws/frontend";
        } else {
          const host = typeof window !== "undefined" ? window.location.host : "localhost:3000";
          const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
          wsUrl = `${protocol}//${host}/ws/frontend`;
        }

        ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (!active) return;
          setConnectionStatus("connected");
          reconnectDelayRef.current = 1000;
        };

        ws.onmessage = (event) => {
          if (!active) return;
          try {
            const message = JSON.parse(event.data);
            const { type, data } = message;

            if (type === "status_update") {
              const wsProjects = data.projects || [];
              setProjects(wsProjects);
              setNodes(data.nodes || []);
              if (data.tickets) {
                setTickets(data.tickets);
              }
              setLastUpdate(Date.now());
            } else if (type === "diff") {
              const incomingDiffs: Diff[] = Array.isArray(data) ? data : [data];
              
              setDiffs((prev) => {
                const enriched = enrichDiffs(incomingDiffs, projectsRef.current);
                const combined = [...enriched, ...prev];
                return combined.slice(0, 100);
              });

              setTickets((prevTickets) => {
                return prevTickets.map((t) => {
                  const match = incomingDiffs.find(
                    (d) => d.ticket_id === t.project_id && d.ticket_name === t.name
                  );
                  if (match) {
                    return {
                      ...t,
                      status: match.new_status,
                      less_vt: match.less_vt,
                      last_updated: match.ts * 1000
                    };
                  }
                  return t;
                });
              });

              setStockHistory((prev) => {
                const validNewPoints = incomingDiffs
                  .filter((d) => d.less_vt >= 0)
                  .map((d) => ({
                    timestamp: d.ts,
                    timeLabel: new Date(d.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    stock: d.less_vt,
                    ticketName: d.ticket_name || "未知票档"
                  }));
                const combined = [...prev, ...validNewPoints].sort((a, b) => a.timestamp - b.timestamp);
                return combined.slice(-40);
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
          setTimeout(() => {
            connectWebSocket();
          }, reconnectDelayRef.current);
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, 10000);
        };

        ws.onerror = () => {
          ws.close();
        };
      }

      connectWebSocket();
    }

    initializeSystem();

    return () => {
      active = false;
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toTimeString().split(" ")[0];
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000); 
    return `${d.getMonth() + 1}/${d.getDate()} ${d.toTimeString().split(" ")[0]}`;
  };

  return (
    <div className="relative flex flex-col min-h-screen text-white font-mono select-none overflow-x-hidden">
      
      {/* 终端开机动画 */}
      {isBooting && (
        <div 
          className={`fixed inset-0 bg-black z-50 flex flex-col justify-between p-8 font-mono text-xs select-none transition-opacity duration-500 ease-in-out ${
            fadeBoot ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <div className="flex flex-col gap-1.5 max-w-xl">
            {bootLogs.map((log, index) => (
              <div key={index} className="text-zinc-400">
                {log}
              </div>
            ))}
            <div className="h-4 w-1.5 bg-white animate-tech-blink mt-1" />
          </div>
          <div className="text-[10px] text-zinc-600 tracking-widest uppercase">
            INITIALIZING TELEMETRY STACK // SYSTEM LOAD ACTIVE
          </div>
        </div>
      )}

      {/* 1. 背景图片 */}
      {BACKGROUND_CONFIG.imageUrl && (
        <div 
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-500"
          style={{ 
            backgroundImage: `url(${BACKGROUND_CONFIG.imageUrl})`,
            opacity: BACKGROUND_CONFIG.opacity,
            filter: `blur(${BACKGROUND_CONFIG.blurAmount})`
          }}
        />
      )}

      {/* 2. 微弱像素网格覆盖层 */}
      <div className="fixed inset-0 z-0 bg-grid-pattern pointer-events-none opacity-60" />

      {/* 3. 页面内容 */}
      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* HEADER WITH BACKDROP BLUR */}
        <header className="sticky top-0 z-40 border-b border-zinc-900/80 bg-black/70 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center gap-2.5">
              <span className={`h-1.5 w-1.5 rounded-full ${connectionStatus === "connected" ? "bg-white" : "bg-red-500 animate-tech-blink"}`} />
              <h1 className="text-sm font-bold tracking-widest uppercase">
                TICKET MONITORING telemetry
              </h1>
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5 tracking-wider">
              ADDR: LOCALHOST:3000 • SYSTEM HEALTH: {nodes.every(n => n.status === "healthy") ? "NOMINAL" : "ALERT"}
            </p>
          </div>

          {/* Tab switch navigation */}
          <nav className="flex border border-zinc-900 p-0.5 bg-[#0a0a0a]/80 backdrop-blur-sm text-xs">
            <button
              onClick={() => setActiveTab("sales")}
              className={`px-4 py-1.5 font-bold uppercase transition-all duration-200 ${
                activeTab === "sales" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              [01] SALES STATUS
            </button>
            <button
              onClick={() => setActiveTab("events")}
              className={`px-4 py-1.5 font-bold uppercase transition-all duration-200 ${
                activeTab === "events" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              [02] EVENT STREAM
            </button>
            <button
              onClick={() => setActiveTab("nodes")}
              className={`px-4 py-1.5 font-bold uppercase transition-all duration-200 ${
                activeTab === "nodes" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              [03] SCRAPING NODES
            </button>
          </nav>
        </header>

        {/* DISCONNECT SCREEN COVER */}
        {connectionStatus === "disconnected" && (
          <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-6 transition-all duration-500">
            <div className="text-[48px] font-sans font-bold tracking-tighter text-zinc-300 animate-tech-blink mb-2">
              [ x _ x ]
            </div>
            <div className="text-xs uppercase tracking-widest text-zinc-400 border-t border-zinc-900 pt-3 mt-1 text-center">
              CONNECTION TO TELEMETRY LOST
              <span className="block text-[10px] text-zinc-600 mt-1">RETRYING TO RESOLVE LINK...</span>
            </div>
          </div>
        )}

        {/* MAIN CONTAINER */}
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">

          {/* TAB 1: TICKET SALES */}
          {activeTab === "sales" && (
            <section className="flex flex-col gap-6 animate-fade-in">
              <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2">
                <span>ACTIVE MONITORED PROJECTS</span>
                <span>TOTAL // {projects.length} UNITS</span>
              </div>

              {projects.length === 0 ? (
                <div className="py-20 text-center border border-zinc-900 bg-zinc-950/40 text-zinc-500 text-xs backdrop-blur-md">
                  [ NO MONITORED PROJECTS ACTIVE ]
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map((project) => {
                    const projectTickets = tickets.filter((t) => t.project_id === project.id);
                    
                    const isExpanded = !!expandedProjects[project.id];
                    const availableCount = projectTickets.filter(
                      (t) => t.status === "可售" || t.status.includes("有票")
                    ).length;

                    return (
                      <div 
                        key={project.id} 
                        className="border border-zinc-900/80 bg-zinc-950/40 backdrop-blur-md p-4 transition-all duration-300 ease-out hover:border-zinc-700 hover:scale-[1.005] hover:shadow-[0_4px_20px_rgba(255,255,255,0.02)] flex flex-col justify-between"
                      >
                        <div>
                          {/* Project Header */}
                          <div className="flex justify-between items-start gap-4 mb-3 border-b border-zinc-900 pb-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] px-1.5 py-0.5 border border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider">
                                  {project.type}
                                </span>
                                <span className="text-[10px] text-zinc-500">ID: {project.id}</span>
                              </div>
                              <h2 className="text-xs font-bold text-white mt-1.5 leading-snug truncate">
                                {project.name || "FETCHING PROJECT INFORMATION..."}
                              </h2>
                            </div>
                            {project.cover && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={project.cover}
                                alt="Poster"
                                className="h-12 w-9 object-cover border border-zinc-800 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            )}
                          </div>

                          {/* Venue */}
                          <div className="text-[10px] text-zinc-400 mb-4 flex items-center gap-1.5">
                            <span>VENUE //</span>
                            <span className="text-zinc-300 truncate">{project.venue_name || "N/A"}</span>
                          </div>

                          {/* Ticket options lists */}
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase tracking-widest">
                              <span>TICKET OPTIONS STATUS:</span>
                              <span className="text-[8px] text-zinc-400">
                                {availableCount} / {projectTickets.length} AVAILABLE
                              </span>
                            </div>

                            {projectTickets.length === 0 ? (
                              <div className="text-[10px] text-zinc-600 italic py-1">
                                No live ticket options reported yet.
                              </div>
                            ) : isExpanded ? (
                              <div className="flex flex-col gap-1.5 transition-all duration-300 ease-in-out origin-top animate-fade-in">
                                {projectTickets.map((t) => {
                                  return (
                                    <div key={t.key} className="flex items-center justify-between text-[11px] bg-black border border-zinc-950 p-2">
                                      <span className="text-zinc-200 truncate pr-4 max-w-[220px]">{t.name}</span>
                                      <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-zinc-400 font-bold">¥{t.price / 100}</span>
                                        {t.less_vt >= 0 && (
                                          <span className="text-[10px] text-zinc-500">
                                            QTY: <strong className={t.less_vt > 0 ? "text-white" : "text-zinc-600"}>{t.less_vt}</strong>
                                          </span>
                                        )}
                                        <span className={`px-2 py-0.5 text-[9px] font-bold border uppercase ${getStatusClasses(t.status)}`}>
                                          {t.status}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}

                                <button
                                  onClick={() => toggleProject(project.id)}
                                  className="w-full text-center py-2 border border-zinc-900 hover:border-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-white transition-all duration-200 mt-2"
                                >
                                  [ COLLAPSE DETAILS ]
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => toggleProject(project.id)}
                                className="w-full py-3.5 border border-zinc-900 hover:border-zinc-700 bg-zinc-950/20 text-center text-[10px] font-bold text-white hover:bg-zinc-950/40 transition-all duration-200 uppercase tracking-wider"
                              >
                                [ Show All {projectTickets.length} Ticket Options ]
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Node assignment footer */}
                        <div className="mt-4 pt-2 border-t border-zinc-900/60 flex justify-between text-[9px] text-zinc-500">
                          <span>ASSIGNED SCRAPER: {project.assigned_node ? `[ ${project.assigned_node} ]` : "NONE"}</span>
                          <span>TELEMETRY CHANNEL</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* TAB 2: EVENT STREAM WITH RECHARTS VISUALIZATION */}
          {activeTab === "events" && (
            <section className="flex flex-col gap-6 animate-fade-in">
              
              {/* 实时库存余量折线面积图 */}
              <div className="border border-zinc-900/80 bg-zinc-950/40 backdrop-blur-md p-4">
                <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-900/80 pb-2 mb-4">
                  <span>REAL-TIME INVENTORY STREAM CHART</span>
                  <span className="text-zinc-400">ACTIVE LOGS TRACKING: {stockHistory.length} EVENTS</span>
                </div>

                <div className="h-64 w-full">
                  {isMounted && stockHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={stockHistory}
                        margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="glowColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ffffff" stopOpacity={0.12}/>
                            <stop offset="95%" stopColor="#ffffff" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid 
                          strokeDasharray="3 3" 
                          stroke="rgba(255, 255, 255, 0.05)" 
                        />
                        <XAxis 
                          dataKey="timeLabel" 
                          stroke="#52525b" 
                          fontSize={9}
                          tickLine={false}
                        />
                        <YAxis 
                          stroke="#52525b" 
                          fontSize={9}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(10, 10, 10, 0.9)",
                            borderColor: "rgba(255, 255, 255, 0.15)",
                            borderRadius: "0px",
                            fontFamily: "monospace",
                            fontSize: "11px",
                            color: "#fff"
                          }}
                          labelClassName="text-zinc-500 font-bold mb-1 block"
                          formatter={(value: any, name: any, props: any) => {
                            return [
                              <span key="tooltip-stock">
                                QTY: <strong className="text-white">{value}</strong>
                                <span className="block text-[9px] text-zinc-400 mt-0.5 truncate max-w-[200px]">
                                  {props.payload.ticketName}
                                </span>
                              </span>,
                              ""
                            ];
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="stock"
                          stroke="#ffffff"
                          strokeWidth={1.5}
                          fillOpacity={1}
                          fill="url(#glowColor)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-zinc-600 italic">
                      [ STANDBY: WAITING FOR NUMERICAL INVENTORY DATA ]
                    </div>
                  )}
                </div>
              </div>

              {/* 传统的实时数据日志流列表 */}
              <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2">
                <span>LIVE TELEMETRY STREAM LOGS</span>
                <span>HISTORY CAP // 100 RECORDS</span>
              </div>

              {diffs.length === 0 ? (
                <div className="py-20 text-center border border-zinc-900 bg-zinc-950/40 text-zinc-500 text-xs backdrop-blur-md">
                  [ NO EVENTS DETECTED YET. STREAMING STANDBY ]
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {diffs.map((diff) => {
                    const isAvailable = diff.new_status === "可售" || diff.new_status.includes("有票");
                    return (
                      <div
                        key={diff.id}
                        className={`border p-3 transition-all duration-300 ease-out flex gap-4 backdrop-blur-md hover:border-zinc-600 ${
                          isAvailable
                            ? "border-white bg-white/10"
                            : "border-zinc-900 bg-zinc-950/45"
                        }`}
                      >
                        {diff.project_cover && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={diff.project_cover}
                            alt="Cover"
                            className="h-10 w-7.5 object-cover border border-zinc-800 shrink-0 self-start"
                            referrerPolicy="no-referrer"
                          />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                            <div className="flex flex-col">
                              {/* Event source project tag if resolved */}
                              {diff.project_name && (
                                <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mb-1 block truncate max-w-[450px]">
                                  📁 PROJECT: {diff.project_name} {diff.project_venue ? `• ${diff.project_venue}` : ""}
                                </span>
                              )}
                              <h3 className="text-xs font-bold text-white leading-relaxed">
                                {diff.ticket_name}
                              </h3>
                            </div>
                            <div className="text-[9px] text-zinc-500 shrink-0 font-bold tracking-wider">
                              TIME // {formatDate(diff.ts)}
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-zinc-900 flex justify-between items-center text-[10px]">
                            <div className="flex items-center gap-1.5">
                              <span className="text-zinc-600 uppercase text-[9px]">STATUS CHANGE:</span>
                              <span className="text-zinc-500 line-through">{diff.old_status}</span>
                              <span className="text-zinc-400">→</span>
                              <span className={`font-bold ${isAvailable ? "text-white underline decoration-zinc-500" : "text-zinc-400"}`}>
                                {diff.new_status}
                              </span>
                            </div>

                            {diff.less_vt >= 0 && (
                              <div className="text-[10px] text-zinc-400">
                                REMAINING STOCK: <span className="font-bold text-white">{diff.less_vt}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* TAB 3: NODES */}
          {activeTab === "nodes" && (
            <section className="flex flex-col gap-6 animate-fade-in">
              <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2">
                <span>SCRAPING NODES INFRASTRUCTURE</span>
                <span>ONLINE // {nodes.filter(n => Date.now() - n.last_heartbeat < 15000).length} NODES</span>
              </div>

              {nodes.length === 0 ? (
                <div className="py-20 text-center border border-zinc-900 bg-zinc-950/40 text-zinc-500 text-xs backdrop-blur-md">
                  [ NO SCRAPER NODES CONNECTED ]
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {nodes.map((node) => {
                    const isAlive = Date.now() - node.last_heartbeat < 15000;
                    const isRiskControl = node.status === "risk_control" || [412, 403, 429].includes(node.last_http_code);
                    const isError = node.status === "error" || (node.last_http_code !== 200 && !isRiskControl);

                    let statusText = "NOMINAL";
                    let statusColor = "text-white border-white";
                    if (isRiskControl) {
                      statusText = "RISK ESCALATION";
                      statusColor = "text-yellow-500 border-yellow-500 animate-tech-blink";
                    } else if (isError) {
                      statusText = "FATAL ERROR";
                      statusColor = "text-red-500 border-red-500 animate-tech-blink";
                    } else if (!isAlive) {
                      statusText = "HEARTBEAT LOST";
                      statusColor = "text-zinc-600 border-zinc-800";
                    }

                    return (
                      <div 
                        key={node.name} 
                        className="border border-zinc-900/80 bg-zinc-950/40 backdrop-blur-md p-4 transition-all duration-300 ease-out hover:border-zinc-700 hover:scale-[1.005] flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-4 mb-3 pb-2 border-b border-zinc-900">
                            <div>
                              <h3 className="text-xs font-bold text-white">{node.name}</h3>
                              <span className="text-[9px] text-zinc-500">HEARTBEAT: {formatTime(node.last_heartbeat)}</span>
                            </div>
                            <span className={`text-[9px] font-bold px-2 py-0.5 border uppercase ${statusColor}`}>
                              {statusText}
                            </span>
                          </div>

                          <div className="flex flex-col gap-2 mt-4 text-[10px] text-zinc-400">
                            <div className="flex justify-between">
                              <span>LAST HTTP CODE:</span>
                              <span className={node.last_http_code === 200 ? "text-white" : "text-red-500 font-bold"}>
                                HTTP {node.last_http_code}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>ASSIGNED TASKS:</span>
                              <span className="text-white font-bold">{node.assigned_project_count ?? 0} ITEMS</span>
                            </div>
                          </div>

                          {node.last_error_message && (
                            <div className="mt-4 text-[9px] bg-red-950/10 border border-red-900/30 p-2 text-red-400 overflow-x-auto whitespace-pre-wrap font-sans">
                              {node.last_error_message}
                            </div>
                          )}
                        </div>

                        <div className="mt-6 text-[8px] text-zinc-700 text-right uppercase">
                          NODE REPORT STATUS OK
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </main>

        {/* FOOTER */}
        <footer className="border-t border-zinc-900/80 bg-black/40 backdrop-blur-sm px-6 py-4 flex flex-col sm:flex-row justify-between items-center text-[9px] text-zinc-500 gap-2 mt-auto">
          <div>
            TELEMETRY HUB v1.0.0 // MONOCHROME EDITION
          </div>
          <div className="flex gap-4">
            <span>LAST Telemetry PACKET: {lastUpdate ? formatTime(lastUpdate) : "NEVER"}</span>
            <span>42G1</span>
          </div>
        </footer>
      </div>

    </div>
  );
}