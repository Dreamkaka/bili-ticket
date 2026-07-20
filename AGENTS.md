# AGENTS.md

分布式 B 站会员购票务监控：`gateway` + Go `probe`（主）+ CF `worker`（辅）+ `web` 看板。各包独立，无根 `package.json`。

## 包与命令

| 包 | 目录 | 安装 | 开发 / 校验 |
|----|------|------|-------------|
| Gateway | `gateway/` | `npm install`（有 `package-lock.json`，勿默认 pnpm） | `npm run dev` / `npm run build` / `npm start` |
| Probe | `probe/` | `go mod tidy` | `go build ./...`；入口 `go run ./cmd/probe` |
| Worker | `worker/` | `npm install` | `npm run typecheck`；本地 **`npm run dev`**（勿直接 `wrangler dev`） |
| Web | `web/` | `npm install` | `npm run dev`（**端口 4000**）/ `npm run build` |

- **Gateway 必开**：`node --experimental-sqlite`（已写进 scripts）；DB 默认 `gateway.db`，可用 `DATABASE_PATH`。
- **Gateway 监听**：固定 `3000`。
- **环境文件**：gateway/probe/worker 读 `.env` + `.env.local`；worker 的 `npm run dev` 会合并写入 `.dev.vars` 再启 wrangler。
- **测试**：probe 暂无单元测试；gateway/web 无统一 test 脚本。

## 架构要点（易错）

- **主探针**：WS ` /ws/probe` → `register` → `assignment` / `reassignment`；上报 `diff`、`node_status`。
- **Worker 辅探针**：HTTP `GET /api/probe/targets`、`POST /api/probe/report`；`role=monitor` **不进** WS 分片、**不触发** reassignment；Cron ~1min；本地 **不自动跑 Cron**，需 `curl http://127.0.0.1:8787/run` 或 `/__scheduled?...`。
- **前端**：WS `/ws/frontend` + HTTP `/api/snapshot|nodes|projects|diffs`；浏览器默认走 Next **同源 rewrite**（见 `web/src/lib/api.ts`），避免 `:4000`→`:3000` CORS；`NEXT_PUBLIC_BASE_URL` 指向 gateway。
- **监控目标**：`gateway/config.json` 的 `core_ids` / `shard_ids` / `poll_interval_ms`；启动同步进 SQLite。k8s 用 ConfigMap，改完需 **rollout restart gateway**。
- **鉴权**：`PROBE_TOKEN` 在 gateway / probe / worker **必须一致**；未配置时开发放行。WS 与 HTTP probe API 均 Bearer。
- **部署**：`deploy/`；Gateway **单副本 + Recreate + PVC**（SQLite RWO，禁止多写）；Probe DaemonSet。镜像 CI：`.github/workflows/build-docker.yml` → GHCR `ticket-gateway` / `ticket-probe`（当前 workflow 仅 `linux/amd64`）。

## 包内注意

- **gateway**：逻辑几乎全在 `src/index.ts`；节点 `role` 默认 `primary`。
- **probe**：Go **1.20**（`go.mod`）；包路径 `cmd/probe`、`internal/{config,wsclient,monitor,bilibili}`。
- **worker**：KV `PROBE_STATE` 的 id 须填入 `wrangler.toml`；生产 secrets 用 `wrangler secret put`。细节见 `worker/README.md`。
- **web**：Next **16** + HeroUI **v3** — 勿按旧记忆写 API；先读 `node_modules/next/dist/docs/` 与 `web/.heroui-docs/react/`（缺文档时在 `web/` 跑 `heroui agents-md --react --output AGENTS.md`）。包内细则见 `web/AGENTS.md`。

## 相关文档

- 子系统 README：`probe/`、`worker/`、`deploy/`