package main

import (
	"log"

	"ticket-probe/internal/bilibili" // 【修改】移除 internal/，回归常规扁平化布局
	"ticket-probe/internal/config"   // 【修改】移除 internal/
	"ticket-probe/internal/monitor"  // 【修改】移除 internal/
	"ticket-probe/internal/wsclient" // 【修改】移除 internal/
)

func main() {
	// 加载探针本地配置
	cfg := config.Load()

	authEnabled := cfg.ProbeToken != ""
	log.Printf(
		"Starting probe: node=%s, gateway=%s, auth=%v",
		cfg.NodeName,
		cfg.GatewayWSURL,
		authEnabled,
	)

	// 初始化 Bilibili 抓取客户端
	biliClient := bilibili.NewClient(cfg.UserAgent)

	// 初始化 Gateway WebSocket 客户端
	ws := wsclient.New(cfg.GatewayWSURL, cfg.NodeName, cfg.ProbeToken)

	// 初始化任务轮询管理器
	mgr := monitor.NewManager(biliClient, ws)

	// 注册网关指派（Assignment）的回调逻辑
	// 当网关重新分配任务（如其他节点上线/下线）时，会自动触发此回调更新本地轮询任务
	ws.SetAssignmentHandler(func(coreIDs, shardIDs []string, interval int) {
		log.Printf(
			"Received assignment from gateway: %d cores, %d shards, poll_interval=%dms",
			len(coreIDs),
			len(shardIDs),
			interval,
		)

		// 动态协调本地协程的启动和停止
		mgr.ApplyAssignment(coreIDs, shardIDs, interval)
	})

	// 运行 WebSocket 客户端主循环（内部包含自动断线重连机制，为阻塞运行）
	ws.Run()
}
