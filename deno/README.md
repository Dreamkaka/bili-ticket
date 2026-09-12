# ticket-deno-probe

Deno Deploy **serverless 主探针**：以 `role=primary` + `transport=http` 与 Go 主探针同级，
但按平台特性做差异实现 —— **不参与** Gateway 的 WebSocket RR 分片，而是分钟级全量冗余监测，
经 HTTP 向 Gateway 上报 `diff` 与心跳。

> 与 `worker/`（Cloudflare，已弃用）的区别：Deno 版本使用不同出口 IP 池，并提升为 primary 等级。

## 平台差异

| | Go 探针 | Deno 探针 |
|--|---------|-----------|
| role / transport | `primary` / `ws` | `primary` / `http` |
| 分片 | 参与 RR | 不参与，全量冗余 |
| 频率 | 秒级 | 分钟级（`Deno.cron`） |
| 状态 | 进程内存 | Deno KV |
| 生命周期 | 常驻长连接 | 无状态，每次 cycle 读 KV 并 diff |

因为 serverless 无法常驻，且分钟级分片会把实时项目降级，故 Deno 只做全量冗余校验，
其在线状态/告警按主探针等级对待。

## 架构

```
Deno.cron (* * * * *)
  → KV 读 targets（TTL 默认 1h，过期才 GET /api/probe/targets）
  → 并发 getV2
  → KV lastState → diff（首轮只写状态不上报）
  → 有 diff 或到心跳周期 → POST /api/probe/report（role=primary, transport=http）
```

## 环境变量

见 `.env.example`。关键项：`GATEWAY_HTTP_URL`、`PROBE_TOKEN`、`NODE_NAME`。
`ROLE` 默认 `primary`、`TRANSPORT` 固定 `http`。Gateway 未配置 `PROBE_TOKEN` 时开发放行。

KV 键：`targets:v1`、`state:{id}`、`meta:run_counter`。

## 本地开发

```bash
cd deno
cp .env.example .env.local   # 填入 GATEWAY_HTTP_URL / PROBE_TOKEN
deno task dev                # = deno run --allow-... --env-file=.env.local src/index.ts
```

本地不依赖 cron，启动后手动触发一轮：

```bash
curl http://127.0.0.1:8000/run
```

成功后 Gateway `GET /api/nodes` 应出现 `deno-probe`（`role=primary`, `transport=http`）。

## 部署到 Deno Deploy

1. 在 Deno Deploy 新建项目，关联本仓库的 `deno/` 目录，入口 `src/index.ts`。
2. Settings → Environment Variables 配置 `GATEWAY_HTTP_URL`、`PROBE_TOKEN`（及可选 `SESSDATA` 等）。
3. 部署后 `Deno.cron` 每分钟自动执行；也可 `curl https://<project>.deno.dev/run` 手动触发。

或用 CLI：

```bash
cd deno
deno task check
deno task deploy
```

## Gateway 依赖

- `GET /api/probe/targets`（Bearer，返回全量 core+shard）
- `POST /api/probe/report`（Bearer，body 含 `node_name` / `role` / `transport` / `status` / `diffs`）

Gateway 须公网 HTTPS；Deno Deploy 无法访问集群内 ClusterIP。
