<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


以下为后端暴露的api接口
* `/ws/frontend`: 用于前端实时接收 `diff` 门票更新广播、`snapshot` 初始数据快照以及定时 `status_update` 广播（每 3 秒）。
* **HTTP API**:
  * `GET /api/snapshot`: 获取整个系统的完整数据快照（包括项目、节点和最新的 50 条变动历史）。
  * `GET /api/nodes`: 获取所有在线节点状态和它们各自被分配的项目数量。
  * `GET /api/projects`: 获取所有项目配置清单及其所属节点。
  * `GET /api/diffs`: 获取票务状态 Diff 变化历史（支持分页 `limit` 和 `offset` 参数）。