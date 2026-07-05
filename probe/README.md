# ticket-probe

无状态的 Go 探针,通过一条 WebSocket 长连接向 gateway 注册、接收监控目标分配、上报票务状态变化。

## 目录结构

```
cmd/probe/main.go          程序入口,装配各模块
internal/config            环境变量配置加载
internal/bilibili           bilibili 票务 API 客户端与状态拍平
internal/wsclient           WebSocket 长连接、重连、消息协议
internal/monitor            按分配动态启停轮询协程、diff 检测
deploy/daemonset.yaml       k8s DaemonSet 示例清单
Dockerfile                  多阶段构建,产出 distroless 极小镜像
```

## 核心行为

1. 启动后连接 `GATEWAY_WS_URL`,发送 `register` 消息(带 `NODE_NAME`,由 k8s Downward API 注入)。
2. 收到 gateway 回复的 `assignment` 消息后,为 `core_ids` + `shard_ids` 里的每个项目 id 各起一个轮询协程。
3. 每个协程按 `poll_interval_ms` 轮询该项目的票务状态,与上一次结果做 diff,有变化就通过同一条连接批量上报 `diff` 消息。
4. 收到 412(风控)时不会一直重试,会做指数退避;连接断开会自动重连并重新注册。
5. gateway 随时可以推送 `reassignment` 消息(比如某个节点掉线触发了重新分片),探针据此增删轮询协程,无需重启。

## 本地构建

沙箱环境无法访问 Go 模块代理,请在你自己有网络访问权限的环境执行:

```bash
go mod tidy      # 会拉取 github.com/gorilla/websocket 并生成 go.sum
go build ./...
docker build -t ticket-probe:dev .
```

## 待你确认/调整的点

- `apiURLTemplate`(internal/bilibili/client.go)里的 B 站接口参数(`version`、`id` vs `project_id`)需要对照实际抓包结果核实,占位实现仅供参考。
- 目前 diff 检测按"票种维度"做 key,如果同一票种需要区分场次+票档,`Key` 的拼接方式可能要再细化。
- `RiskControlError` 触发 3 次后仅做退避,如果你希望探针在被封后主动向 gateway 报告"该节点该项目不可用"以触发提前重新分片,需要再加一个消息类型。
