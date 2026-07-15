# ticket-worker-probe

Cloudflare Worker **辅助监测探针**：分钟级 Cron 拉取 B 站票务状态，KV 做 lastState / 目标列表缓存，经 HTTP 向 Gateway 上报 `diff` 与心跳。

与 Go 主探针并行：`role=monitor`，**不参与** WebSocket 分片 / reassignment。

## 架构

```
Cron (* * * * *)
  → KV 读 targets（TTL 默认 1h，过期才 GET /api/probe/targets）
  → 并发 getV2
  → KV lastState → diff（首轮只写状态不上报）
  → 有 diff 或到心跳周期 → POST /api/probe/report
```

## 环境变量

| 名称 | 类型 | 说明 |
|------|------|------|
| `GATEWAY_HTTP_URL` | secret / 本地 env | 网关根地址，如 `https://gateway.example.com` 或本地 `http://127.0.0.1:3000` |
| `PROBE_TOKEN` | secret / 本地 env | 与网关 `PROBE_TOKEN` 一致；网关未配置时可空 |
| `NODE_NAME` | var | 默认 `cf-worker-monitor` |
| `PROBE_USER_AGENT` | var | 请求 B 站 UA |
| `CORE_IDS` / `SHARD_IDS` | var | 可选冷启动种子（逗号分隔），减少对 targets 依赖 |
| `TARGETS_TTL_SEC` | var | 目标列表缓存秒数，默认 `3600` |
| `HEARTBEAT_EVERY_N_RUNS` | var | 无 diff 时每 N 次 Cron 报一次心跳，默认 `5` |
| `MAX_CONCURRENCY` | var | getV2 并发，默认 `3` |

KV binding：`PROBE_STATE`（存 `targets:v1`、`state:{id}`、`meta:run_counter`）。

## 部署

```bash
cd worker
npm install
# 创建 KV 后把 id 填进 wrangler.toml
npx wrangler kv namespace create PROBE_STATE
npx wrangler kv namespace create PROBE_STATE --preview

# 编辑 wrangler.toml 中的 id / preview_id
npx wrangler secret put GATEWAY_HTTP_URL
npx wrangler secret put PROBE_TOKEN

npm run deploy
```

本地：

```bash
# worker/.env.local（与 gateway/probe 习惯一致）
# GATEWAY_HTTP_URL=http://127.0.0.1:3000
# PROBE_TOKEN=...

cd worker
npm run dev
```

`npm run dev` 会：
1. 读取 `.env` + `.env.local`
2. 写入 `.dev.vars`
3. 用 `wrangler --var` 再次注入（避免只写 `.dev.vars` 仍读不到）

访问 `http://127.0.0.1:8787/` 可看到 `gateway_http_url` 是否注入成功。

**本地不会自动跑 Cron**（Miniflare 限制）。启动后手动触发一次：

```bash
curl http://127.0.0.1:8787/run
# 或（需 --test-scheduled，npm run dev 已带上）
curl "http://127.0.0.1:8787/__scheduled?cron=*+*+*+*+*"
```

成功后 Gateway `GET /api/nodes` 应出现 `cf-worker-monitor`（`role=monitor`）。

> 不要直接 `npx wrangler dev`（不会读 `.env.local`）。生产用 `wrangler secret put`。

## Gateway 依赖

需已部署：

- `GET /api/probe/targets`（Bearer）
- `POST /api/probe/report`（Bearer，body 含 `node_name` / `role` / `status` / `diffs`）

网关须公网 HTTPS；Worker 无法访问集群内 ClusterIP。

## 与 Go 探针差异

| | Go | Worker |
|--|-----|--------|
| 协议 | WS `/ws/probe` | HTTP `/api/probe/*` |
| 频率 | 秒级 | ~1 分钟 |
| 分片 | 参与 RR | 全量冗余监测 |
| 状态 | 进程内存 | KV |
