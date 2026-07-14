import { Elysia, t } from "elysia";
import { node } from "@elysia/node";
import { DatabaseSync } from "node:sqlite";
import * as fs from "fs";
import * as path from "path";
import { openapi } from "@elysia/openapi";

// 初始化 SQLite 数据库（Node.js 内置 node:sqlite）
const dbPath =
  process.env.DATABASE_PATH || path.join(process.cwd(), "gateway.db");
// 确保数据库文件所在的目录存在
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new DatabaseSync(dbPath);

function dbTransaction<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
  return (...args: TArgs) => {
    db.exec("BEGIN");
    try {
      const result = fn(...args);
      db.exec("COMMIT");
      return result;
    } catch (err) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // ignore rollback errors
      }
      throw err;
    }
  };
}

// 创建并更新数据库表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    type TEXT CHECK(type IN ('core', 'shard')) NOT NULL,
    assigned_node TEXT,
    name TEXT,             -- 演出名称
    venue_name TEXT,       -- 场馆名称
    cover TEXT             -- 海报图片链接
  );

  CREATE TABLE IF NOT EXISTS nodes (
    name TEXT PRIMARY KEY,
    last_heartbeat INTEGER NOT NULL,
    reassign_pending INTEGER DEFAULT 0,
    status TEXT DEFAULT 'healthy',
    last_http_code INTEGER DEFAULT 200,
    last_error_message TEXT
  );

  CREATE TABLE IF NOT EXISTS diffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    ticket_name TEXT NOT NULL,
    old_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    ts INTEGER NOT NULL,
    less_vt INTEGER DEFAULT -1
  );

  -- 实时票种状态表，记录每个票种档位最及时的状态与余票
  CREATE TABLE IF NOT EXISTS tickets (
    project_id TEXT,
    sub_ticket_id INTEGER,
    key TEXT PRIMARY KEY, -- 格式为: "<screen_name>-<sub_ticket_id>"
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    price INTEGER,
    less_vt INTEGER DEFAULT -1,
    last_updated INTEGER
  );
`);

// 【自适应数据库热升级】自动检测旧数据库并补全字段
try {
  const tableInfo = db.prepare("PRAGMA table_info(projects)").all() as {
    name: string;
  }[];
  const columns = tableInfo.map((c) => c.name);
  if (!columns.includes("name")) {
    db.exec("ALTER TABLE projects ADD COLUMN name TEXT;");
  }
  if (!columns.includes("venue_name")) {
    db.exec("ALTER TABLE projects ADD COLUMN venue_name TEXT;");
  }
  if (!columns.includes("cover")) {
    db.exec("ALTER TABLE projects ADD COLUMN cover TEXT;");
  }
} catch (e) {
  console.error("Database self-check / migration failed:", e);
}

const configPath =
  process.env.CONFIG_PATH || path.join(process.cwd(), "config.json");
let initialPollInterval = 5000;

// 请求 Bilibili 接口获取门票基础元数据
async function fetchProjectMetadata(projectId: string) {
  const url = `https://show.bilibili.com/api/ticket/project/get?version=134&id=${projectId}`;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://show.bilibili.com/",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    });
    const json: any = await response.json();

    if (json && (json.errno === 0 || json.success === true) && json.data) {
      let coverUrl = json.data.cover || "";
      if (coverUrl.startsWith("//")) {
        coverUrl = "https:" + coverUrl;
      }

      // 深度解析出该演出下的所有初始票种档位
      const tickets: {
        sub_ticket_id: number;
        key: string;
        name: string;
        status: string;
        price: number;
      }[] = [];
      if (Array.isArray(json.data.screen_list)) {
        for (const screen of json.data.screen_list) {
          const screenName = screen.name || "";
          if (Array.isArray(screen.ticket_list)) {
            for (const t of screen.ticket_list) {
              const ticketId = t.id;
              const desc = t.desc || "";
              const price = t.price || 0;
              const status = t.sale_flag?.display_name || "未知";
              const key = `${screenName}-${ticketId}`;
              tickets.push({
                sub_ticket_id: ticketId,
                key: key,
                name: `${screenName} / ${desc}`,
                status: status,
                price: price,
              });
            }
          }
        }
      }

      return {
        name: json.data.name || "",
        venue_name: json.data.venue_info?.name || "",
        cover: coverUrl,
        tickets: tickets,
      };
    } else {
      console.warn(
        `Bilibili API returned unsuccessful structure for project [${projectId}]:`,
        json,
      );
    }
  } catch (err) {
    console.error(
      `Network error: Failed to fetch metadata for project [${projectId}]:`,
      err,
    );
  }
  return null;
}

// 异步同步配置和拉取数据的函数
async function syncProjectsFromConfig() {
  if (!fs.existsSync(configPath)) {
    console.log("No config.json found.");
    return;
  }

  try {
    const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (configData.poll_interval_ms) {
      initialPollInterval = configData.poll_interval_ms;
    }

    const currentIds = new Set<string>();
    const tasks: { id: string; type: "core" | "shard" }[] = [];

    if (Array.isArray(configData.core_ids)) {
      for (const id of configData.core_ids) {
        currentIds.add(String(id));
        tasks.push({ id: String(id), type: "core" });
      }
    }
    if (Array.isArray(configData.shard_ids)) {
      for (const id of configData.shard_ids) {
        currentIds.add(String(id));
        tasks.push({ id: String(id), type: "shard" });
      }
    }

    const insertProj = db.prepare(`
      INSERT INTO projects (id, type, name, venue_name, cover)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        name = COALESCE(excluded.name, projects.name),
        venue_name = COALESCE(excluded.venue_name, projects.venue_name),
        cover = COALESCE(excluded.cover, projects.cover)
    `);

    const upsertTicketFromMeta = db.prepare(`
      INSERT INTO tickets (project_id, sub_ticket_id, key, name, status, price, less_vt, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        status = excluded.status,
        price = excluded.price,
        last_updated = excluded.last_updated
    `);

    for (const task of tasks) {
      console.log(`[Meta Sync] Fetching metadata for project [${task.id}]...`);
      const meta = await fetchProjectMetadata(task.id);

      if (meta) {
        console.log(
          `[Meta Sync] Success: found "${meta.name}" with ${meta.tickets.length} ticket types for project [${task.id}]`,
        );

        insertProj.run(
          task.id,
          task.type,
          meta.name || null,
          meta.venue_name || null,
          meta.cover || null,
        );

        const now = Date.now();
        const insertTicketsTx = dbTransaction((ticketsList: any[]) => {
          for (const tk of ticketsList) {
            upsertTicketFromMeta.run(
              task.id,
              tk.sub_ticket_id,
              tk.key,
              tk.name,
              tk.status,
              tk.price,
              -1,
              now,
            );
          }
        });
        insertTicketsTx(meta.tickets);
      } else {
        console.warn(
          `[Meta Sync] Warn: could not fetch details for project [${task.id}], inserting blank metadata instead.`,
        );
        insertProj.run(task.id, task.type, null, null, null);
      }
    }

    // 清理 config.json 中已删除但存在于 db 里的项目及属于该项目的票种状态
    const allProjs = db.prepare("SELECT id FROM projects").all() as {
      id: string;
    }[];
    const deleteProj = db.prepare("DELETE FROM projects WHERE id = ?");
    const deleteTickets = db.prepare(
      "DELETE FROM tickets WHERE project_id = ?",
    );
    for (const p of allProjs) {
      if (!currentIds.has(p.id)) {
        deleteProj.run(p.id);
        deleteTickets.run(p.id);
      }
    }

    console.log(
      `[Config Sync] Synced ${tasks.length} projects successfully. Poll interval: ${initialPollInterval}ms`,
    );
  } catch (err) {
    console.error("[Config Sync] Failed to sync projects from config:", err);
  }
}

// 执行异步同步
syncProjectsFromConfig().then(() => {
  console.log("[Init] Database projects metadata synchronization finished.");
});

const activeSockets = new Map<string, any>();
const socketToNodeMap = new Map<string, string>();
const activeFrontendSockets = new Set<any>();

function triggerReassignment() {
  const activeNodes = Array.from(activeSockets.keys());

  if (activeNodes.length === 0) {
    db.prepare("UPDATE projects SET assigned_node = NULL").run();
    return;
  }

  const allProjs = db.prepare("SELECT id, type FROM projects").all() as {
    id: string;
    type: "core" | "shard";
  }[];
  const updateProjAssignment = db.prepare(
    "UPDATE projects SET assigned_node = ? WHERE id = ?",
  );

  allProjs.forEach((proj, idx) => {
    const targetNode = activeNodes[idx % activeNodes.length]!;
    updateProjAssignment.run(targetNode, proj.id);
  });

  console.log(
    `Reassigned ${allProjs.length} projects across ${activeNodes.length} active WS nodes.`,
  );

  for (const nodeName of activeNodes) {
    const ws = activeSockets.get(nodeName);
    if (ws) {
      const cores = db
        .prepare(
          "SELECT id FROM projects WHERE assigned_node = ? AND type = 'core'",
        )
        .all(nodeName) as { id: string }[];
      const shards = db
        .prepare(
          "SELECT id FROM projects WHERE assigned_node = ? AND type = 'shard'",
        )
        .all(nodeName) as { id: string }[];

      const payload = {
        type: "reassignment",
        data: {
          core_ids: cores.map((c) => c.id),
          shard_ids: shards.map((s) => s.id),
          poll_interval_ms: initialPollInterval,
        },
      };
      try {
        ws.send(JSON.stringify(payload));
      } catch (err) {
        console.error(`Failed to push reassignment to ${nodeName}:`, err);
      }
    }
  }
}

const app = new Elysia({ adapter: node() })
  .use(openapi())
  .ws("/ws/probe", {
    open(ws) {
      console.log(`WS connection opened, id: ${ws.id}`);
    },
    message(ws, rawMessage: any) {
      let envelope: any;
      try {
        envelope =
          typeof rawMessage === "string" ? JSON.parse(rawMessage) : rawMessage;
      } catch (e) {
        console.error("Failed to parse WS message:", e);
        return;
      }
      const { type, data } = envelope;
      if (!type) {
        console.log("Received unknown/malformed envelope:", envelope);
        return;
      }

      switch (type) {
        case "register": {
          const nodeName = data?.node_name;
          if (!nodeName) {
            console.error("Register payload missing node_name");
            return;
          }

          console.log(`Probe registered: ${nodeName} (ws.id: ${ws.id})`);

          // 保存此连接及 ws.id 映射
          activeSockets.set(nodeName, ws);
          socketToNodeMap.set(ws.id, nodeName);

          const now = Date.now();
          db.prepare(
            `
            INSERT INTO nodes (name, last_heartbeat, reassign_pending, status, last_http_code, last_error_message)
            VALUES (?, ?, 0, 'healthy', 200, '')
            ON CONFLICT(name)
            DO UPDATE SET last_heartbeat = ?, status = 'healthy', last_http_code = 200, last_error_message = ''
          `,
          ).run(nodeName, now, now);

          triggerReassignment();

          const cores = db
            .prepare(
              "SELECT id FROM projects WHERE assigned_node = ? AND type = 'core'",
            )
            .all(nodeName) as { id: string }[];
          const shards = db
            .prepare(
              "SELECT id FROM projects WHERE assigned_node = ? AND type = 'shard'",
            )
            .all(nodeName) as { id: string }[];

          const responsePayload = {
            type: "assignment",
            data: {
              core_ids: cores.map((c) => c.id),
              shard_ids: shards.map((s) => s.id),
              poll_interval_ms: initialPollInterval,
            },
          };
          ws.send(JSON.stringify(responsePayload));
          break;
        }

        // 处理探针上报节点健康状态的请求
        case "node_status": {
          const nodeName = socketToNodeMap.get(ws.id);
          if (!nodeName) {
            console.error(
              "Received status update from unregistered connection",
            );
            return;
          }

          const { status, http_code, message } = data || {};
          console.log(
            `Node [${nodeName}] reported status: ${status} (HTTP ${http_code})`,
          );

          try {
            db.prepare(
              `
              UPDATE nodes
              SET status = ?, last_http_code = ?, last_error_message = ?, last_heartbeat = ?
              WHERE name = ?
            `,
            ).run(
              String(status || "healthy"),
              Number(http_code || 200),
              String(message || ""),
              Date.now(),
              nodeName,
            );
          } catch (err) {
            console.error("Failed to update node status in database:", err);
          }
          break;
        }

        case "diff": {
          // 使用 ws.id 获取节点名称
          const nodeName = socketToNodeMap.get(ws.id);
          if (!nodeName) {
            console.error(
              `Received diff event from unregistered connection (ws.id: ${ws.id})`,
            );
            return;
          }

          console.log(
            `Received diff event from node: ${nodeName}, data size: ${Array.isArray(data) ? data.length : 0}`,
          );
          if (!Array.isArray(data)) {
            console.error("Diff payload data is not an array");
            return;
          }

          // 1. 准备向变动日志表写入流水
          const insertDiff = db.prepare(`
            INSERT INTO diffs (ticket_id, ticket_name, old_status, new_status, ts, less_vt)
            VALUES (?, ?, ?, ?, ?, ?)
          `);

          // 2. 准备向票种状态表写入/更新最新状态（UPSERT 机制）
          const upsertTicketFromDiff = db.prepare(`
            INSERT INTO tickets (project_id, sub_ticket_id, key, name, status, price, less_vt, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
              status = excluded.status,
              less_vt = excluded.less_vt,
              last_updated = excluded.last_updated
          `);

          const insertMany = dbTransaction((diffs: any[]) => {
            for (const diff of diffs) {
              // 写入变动历史
              insertDiff.run(
                String(diff.ticket_id),
                String(diff.name || diff.ticket_name || ""),
                String(diff.old_status),
                String(diff.new_status),
                Number(diff.ts),
                Number(diff.less_vt ?? -1),
              );

              // 更新该票种的最新状态和余票
              upsertTicketFromDiff.run(
                String(diff.ticket_id),
                Number(diff.sub_ticket_id),
                String(diff.key),
                String(diff.name || diff.ticket_name || ""),
                String(diff.new_status),
                Number(diff.price || 0),
                Number(diff.less_vt ?? -1),
                Number(diff.ts),
              );
            }
          });

          try {
            insertMany(data);
            for (const client of activeFrontendSockets) {
              try {
                // 广播实时 diff 时，显式转为 JSON 字符串发送
                client.send(
                  JSON.stringify({
                    type: "diff",
                    data: data,
                  }),
                );
              } catch (err) {
                console.error(
                  "Failed to broadcast diff to frontend client:",
                  err,
                );
              }
            }
          } catch (err) {
            console.error(
              "Failed to insert diffs and tickets into database:",
              err,
            );
          }
          break;
        }

        default:
          console.log(`Unhandled message type: ${type}`);
      }
    },
    close(ws) {
      // 使用 ws.id 获取并清除节点名称
      const nodeName = socketToNodeMap.get(ws.id);
      if (nodeName) {
        console.log(`WS connection closed for node: ${nodeName}`);
        activeSockets.delete(nodeName);
        socketToNodeMap.delete(ws.id);
        db.prepare("DELETE FROM nodes WHERE name = ?").run(nodeName);
        triggerReassignment();
      } else {
        console.log(`WS connection closed (unregistered, ws.id: ${ws.id})`);
      }
    },
  })
  .ws("/ws/frontend", {
    open(ws) {
      console.log("Frontend WS connection opened");
      activeFrontendSockets.add(ws);

      try {
        // 【健壮性修改】使用更加安全和兼容的强制类型转换方式读取 limit，默认设为 200
        let parsedLimit = 200;
        if (ws.data.query.limit !== undefined) {
          const l = parseInt(String(ws.data.query.limit), 10);
          if (!isNaN(l)) parsedLimit = l;
        }

        const projects = db
          .prepare(
            "SELECT id, type, assigned_node, name, venue_name, cover FROM projects",
          )
          .all();
        const nodes = db
          .prepare(
            "SELECT name, status, last_http_code, last_error_message, last_heartbeat FROM nodes",
          )
          .all();
        const tickets = db
          .prepare(
            "SELECT project_id, sub_ticket_id, key, name, status, price, less_vt, last_updated FROM tickets WHERE status != 'removed'",
          )
          .all();
        const recentDiffs = db
          .prepare(
            "SELECT id, ticket_id, ticket_name, old_status, new_status, ts, less_vt FROM diffs ORDER BY id DESC LIMIT ?",
          )
          .all(parsedLimit);

        // 发送快照，增加 diffs 别名支持，并显式执行 JSON.stringify 序列化
        ws.send(
          JSON.stringify({
            type: "snapshot",
            data: {
              projects,
              nodes,
              tickets,
              diffs: recentDiffs, // 增加兼容别名
              recentDiffs,
            },
          }),
        );
      } catch (err) {
        console.error("Failed to send initial snapshot to frontend:", err);
      }
    },
    message(ws, rawMessage: any) {
      console.log("Received message from frontend:", rawMessage);
    },
    close(ws) {
      console.log("Frontend WS connection closed");
      activeFrontendSockets.delete(ws);
    },
  })
  // HTTP 版本的初始状态快照获取接口
  .get(
    "/api/snapshot",
    ({ query }) => {
      try {
        // 【健壮性修改】使用安全的类型强转，防止因为 Elysia 类型转换导致默认值覆盖
        let parsedLimit = 200;
        if (query && query.limit !== undefined) {
          const l = parseInt(String(query.limit), 10);
          if (!isNaN(l)) parsedLimit = l;
        }

        const projects = db
          .prepare(
            "SELECT id, type, assigned_node, name, venue_name, cover FROM projects",
          )
          .all();
        const nodes = db
          .prepare(
            "SELECT name, status, last_http_code, last_error_message, last_heartbeat FROM nodes",
          )
          .all();
        const tickets = db
          .prepare(
            "SELECT project_id, sub_ticket_id, key, name, status, price, less_vt, last_updated FROM tickets WHERE status != 'removed'",
          )
          .all();
        const recentDiffs = db
          .prepare(
            "SELECT id, ticket_id, ticket_name, old_status, new_status, ts, less_vt FROM diffs ORDER BY id DESC LIMIT ?",
          )
          .all(parsedLimit);

        return {
          projects,
          nodes,
          tickets,
          diffs: recentDiffs, // 兼容性别名
          recentDiffs,
        };
      } catch (err: any) {
        return { error: err.message || "Database error" };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    },
  )
  .get("/api/nodes", () => {
    try {
      const query = `
        SELECT
          n.name,
          n.last_heartbeat,
          n.reassign_pending,
          n.status,
          n.last_http_code,
          n.last_error_message,
          (SELECT COUNT(*) FROM projects p WHERE p.assigned_node = n.name) as assigned_project_count
        FROM nodes n
      `;
      const nodes = db.prepare(query).all();
      return nodes;
    } catch (err: any) {
      return { error: err.message || "Database error" };
    }
  })
  .get("/api/projects", () => {
    try {
      const projects = db
        .prepare(
          "SELECT id, type, assigned_node, name, venue_name, cover FROM projects",
        )
        .all();
      return projects;
    } catch (err: any) {
      return { error: err.message || "Database error" };
    }
  })
  .get(
    "/api/diffs",
    ({ query }) => {
      try {
        // 【健壮性/核心升级】默认返回数量由 50 提升至 200，并使用 String() 强制转换方案，支持 /api/diffs?limit=X 稳定运行
        let parsedLimit = 200;
        let parsedOffset = 0;

        if (query) {
          if (query.limit !== undefined) {
            const l = parseInt(String(query.limit), 10);
            if (!isNaN(l)) parsedLimit = l;
          }
          if (query.offset !== undefined) {
            const o = parseInt(String(query.offset), 10);
            if (!isNaN(o)) parsedOffset = o;
          }
        }

        const diffs = db
          .prepare(
            "SELECT id, ticket_id, ticket_name, old_status, new_status, ts, less_vt FROM diffs ORDER BY id DESC LIMIT ? OFFSET ?",
          )
          .all(parsedLimit, parsedOffset);
        return diffs;
      } catch (err: any) {
        return { error: err.message || "Database error" };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )
  .get("/", () => "Hello Elysia")
  .listen(3000, ({ hostname, port }) => {
    console.log(`🦊 Elysia is running at ${hostname}:${port}`);
  });

// 定时广播器：每 3 秒将最新节点、项目状态及完整的票种实时状态推送给所有前端
setInterval(() => {
  if (activeFrontendSockets.size === 0) return;

  try {
    const projects = db
      .prepare(
        "SELECT id, type, assigned_node, name, venue_name, cover FROM projects",
      )
      .all();
    const nodes = db
      .prepare(
        "SELECT name, status, last_http_code, last_error_message, last_heartbeat FROM nodes",
      )
      .all();
    const tickets = db
      .prepare(
        "SELECT project_id, sub_ticket_id, key, name, status, price, less_vt, last_updated FROM tickets WHERE status != 'removed'",
      )
      .all();

    const payload = JSON.stringify({
      type: "status_update",
      data: {
        projects,
        nodes,
        tickets,
      },
    });

    for (const client of activeFrontendSockets) {
      try {
        client.send(payload);
      } catch (err) {
        console.error("Failed to broadcast periodic status to frontend:", err);
      }
    }
  } catch (err) {
    console.error("Periodic background status query failed:", err);
  }
}, 3000);
