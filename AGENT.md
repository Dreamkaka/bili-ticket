# AGENT.md


## 常用命令

### 1. Gateway (Elysia.js / Node.js)
* **安装依赖**: `pnpm install` (在 `gateway` 目录下)
* **启动开发服务**: `pnpm dev`
* **构建/编译**: `pnpm build`
* **运行生产环境**: `pnpm start`

### 2. Probe (Go 探针)
* **安装依赖**: `go mod tidy` (在 `probe` 目录下)
* **编译/检查**: `go build ./...`
* **本地运行入口**: `go run cmd/probe/main.go`
* **运行测试**: 本项目内暂无单元测试
* **Docker 构建**: `docker build -t ticket-probe:dev .`

---

## 架构与系统设计

这是一个**票务监控系统**，采用 Gateway + Probe 架构：

### 1. Gateway (`gateway`)
* 基于 **Elysia.js** (运行于 Node.js 环境，由 `@elysia/node` 提供适配层)。
* 主要职责：接收无状态 Go 探针 (`probe`) 的注册，维护各节点的状态，根据调度策略将监控目标（B 站项目 ID）分配给各个探针。
* **数据持久化**: 使用 SQLite 数据库 (`gateway.db`, 基于 Node.js 内置 `node:sqlite`) 存储项目 (projects)、在线节点 (nodes) 以及门票状态变化历史 (diffs)。
* **项目与节点管理**: 启动时会解析 `config.json` 将项目同步到 SQLite；节点通过 WebSocket 连接时在 `nodes` 表中记录心跳，断开时删除对应节点，并触发重新分配平衡。
* **WebSocket API**: 
  * `/ws/probe`: 用于 Go 探针连接。**连接级鉴权**：若配置了环境变量 `PROBE_TOKEN`，握手必须携带 `Authorization: Bearer <token>`，校验失败则拒绝升级；未配置时开发放行。探针需要先发送 `register` 消息，随后 Gateway 响应 `assignment`，并会在重新平衡或有更新时推送 `reassignment`。探针会上报 `diff` 事件，Gateway 接收后写入 SQLite 历史记录并广播至前端。同时，探针也在此连接上通过 `node_status` 消息上报自身的健康状态与接口响应状态。
  * `/ws/frontend`: 用于前端实时接收 `diff` 门票更新广播、`snapshot` 初始数据快照以及定时 `status_update` 广播（每 3 秒）。
* **HTTP API**:
  * `GET /api/snapshot`: 获取整个系统的完整数据快照（包括项目、节点和最新的 50 条变动历史）。
  * `GET /api/nodes`: 获取所有在线节点状态和它们各自被分配的项目数量。
  * `GET /api/projects`: 获取所有项目配置清单及其所属节点。
  * `GET /api/diffs`: 获取票务状态 Diff 变化历史（支持分页 `limit` 和 `offset` 参数）。

### 2. Probe (`probe`)
* 基于 **Go 1.22** 编写的无状态探针。
* **通信协议**: 通过一条 WebSocket 连接与 Gateway 交互。消息均使用 JSON 包裹 `Envelope` 进行传输。
* **核心组件与工作流程**:
  * `config.Load()`: 通过环境变量（如 `NODE_NAME`, `GATEWAY_WS_URL`, `PROBE_USER_AGENT`, `PROBE_TOKEN`）加载探针配置。
  * `wsclient.Client`: 维护与 Gateway 的 WebSocket 连接。若设置了 `PROBE_TOKEN`，Dial 时附带 `Authorization: Bearer`。支持断线重连（指数退避），拥有发送缓存区，并在连接建立后自动发送 `register` 进行注册。并对接收的 `assignment` 和 `reassignment` 消息做相同的任务映射指派。
  * `monitor.Manager`: 监听连接的 `OnAssignment` 回调，解析 Gateway 分配 of `core_ids` 和 `shard_ids`，动态增删轮询协程。
  * `bilibili.Client`: 封装 B 站票务详情 API 请求 (`https://show.bilibili.com/api/ticket/project/getV2`)。
* **轮询协程与风控策略**:
  * 每个被分配的项目单独启用一个 Go 协程（通过 `context.CancelFunc` 控制生命周期），并使用 `rand.Intn` 对启动时间进行微小随机抖动 (jitter) 避免请求对齐。
  * 周期性拉取最新的票务数据，与上次缓存的状态对比（通过 `diffStates`），当售票状态或余票数量 (`less_vt`) 发生更新时，将 Diff 打包发送至 WebSocket 缓冲区。
  * 针对请求响应 HTTP Status 412/403/429 或 B 站业务接口返回错误码 -412 的情况，连续触发 3 次后，实施指数退避限制请求频率（重试间隔随次数增加），并实时向网关上报 `risk_control` 或 `error` 状态。
