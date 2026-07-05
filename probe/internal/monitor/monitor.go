package monitor

import (
	"context"
	"errors"
	"log"
	"math/rand"
	"sync"
	"time"

	"ticket-probe/internal/bilibili"
	"ticket-probe/internal/wsclient"
)

type Manager struct {
	client       *bilibili.Client
	ws           *wsclient.Client
	pollInterval time.Duration

	mu      sync.Mutex
	pollers map[string]context.CancelFunc
}

func NewManager(client *bilibili.Client, ws *wsclient.Client) *Manager {
	return &Manager{
		client:       client,
		ws:           ws,
		pollInterval: time.Second,
		pollers:      make(map[string]context.CancelFunc),
	}
}

// ApplyAssignment reconciles running pollers against a fresh set of
// assigned project ids. Safe to call repeatedly — only the diff
// between the current and new set causes goroutines to start/stop.
func (m *Manager) ApplyAssignment(coreIDs, shardIDs []string, pollIntervalMs int) {
	if pollIntervalMs > 0 {
		m.pollInterval = time.Duration(pollIntervalMs) * time.Millisecond
	}

	wanted := make(map[string]bool, len(coreIDs)+len(shardIDs))
	for _, id := range coreIDs {
		wanted[id] = true
	}
	for _, id := range shardIDs {
		wanted[id] = true
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	for id, cancel := range m.pollers {
		if !wanted[id] {
			cancel()
			delete(m.pollers, id)
			log.Printf("stopped polling project %s (unassigned)", id)
		}
	}
	for id := range wanted {
		if _, exists := m.pollers[id]; !exists {
			ctx, cancel := context.WithCancel(context.Background())
			m.pollers[id] = cancel
			go m.pollLoop(ctx, id)
			log.Printf("started polling project %s", id)
		}
	}
}

func (m *Manager) pollLoop(ctx context.Context, projectID string) {
	// stagger startup so assigned pollers don't all hit the API in lockstep
	jitter := time.Duration(rand.Intn(500)) * time.Millisecond
	select {
	case <-time.After(jitter):
	case <-ctx.Done():
		return
	}

	lastState := make(map[string]bilibili.TicketState)
	ticker := time.NewTicker(m.pollInterval)
	defer ticker.Stop()

	consecutiveRiskHits := 0

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			newState, err := m.client.Fetch(projectID)
			if err != nil {
				// 1. 处理 HTTP 层面异常（如 412 风控、429 限流等）
				var httpErr *bilibili.HTTPError
				if errors.As(err, &httpErr) {
					if httpErr.StatusCode == 412 || httpErr.StatusCode == 403 || httpErr.StatusCode == 429 {
						consecutiveRiskHits++
						log.Printf("HTTP risk control status (%d) on project %s (%d consecutive)", httpErr.StatusCode, projectID, consecutiveRiskHits)
						m.ws.ReportStatus("risk_control", httpErr.StatusCode, "IP rate limited or blocked")

						// 达到多次连续触发风控时，执行指数级退避，防止频繁请求加重封锁
						if consecutiveRiskHits >= 3 {
							backoff := time.Duration(consecutiveRiskHits) * 10 * time.Second
							log.Printf("backing off project %s for %s", projectID, backoff)
							select {
							case <-time.After(backoff):
							case <-ctx.Done():
								return
							}
						}
					} else {
						// 其他常规 HTTP 错误（如 502 Bad Gateway / 500 等）
						consecutiveRiskHits = 0
						log.Printf("HTTP poll error for project %s: %v", projectID, err)
						m.ws.ReportStatus("error", httpErr.StatusCode, httpErr.Error())
					}
					continue
				}

				// 2. 处理 Bilibili 业务逻辑层异常（如接口直接返回 -412 业务风控）
				var apiErr *bilibili.APIError
				if errors.As(err, &apiErr) {
					if apiErr.Errno == -412 {
						consecutiveRiskHits++
						log.Printf("API business risk control (errno -412) on project %s (%d consecutive)", projectID, consecutiveRiskHits)
						m.ws.ReportStatus("risk_control", 200, "Bilibili API business block (-412)")

						if consecutiveRiskHits >= 3 {
							backoff := time.Duration(consecutiveRiskHits) * 10 * time.Second
							log.Printf("backing off project %s for %s", projectID, backoff)
							select {
							case <-time.After(backoff):
							case <-ctx.Done():
								return
							}
						}
					} else {
						// 其他正常的业务逻辑接口报错（如项目不存在等）
						consecutiveRiskHits = 0
						log.Printf("API poll error for project %s: %v", projectID, err)
						m.ws.ReportStatus("error", 200, apiErr.Error())
					}
					continue
				}

				// 3. 处理本地网络超时、DNS 解析错误等底层网络异常
				consecutiveRiskHits = 0
				log.Printf("general poll network error for project %s: %v", projectID, err)
				m.ws.ReportStatus("error", 0, err.Error())
				continue
			}

			// 抓取成功，恢复连续风控计数并上报健康状态
			consecutiveRiskHits = 0
			m.ws.ReportStatus("healthy", 200, "OK")

			diffs := diffStates(projectID, lastState, newState)
			if len(diffs) > 0 {
				m.ws.SendDiffs(diffs)
			}
			lastState = newState
		}
	}
}

func diffStates(projectID string, oldS, newS map[string]bilibili.TicketState) []wsclient.DiffEvent {
	var out []wsclient.DiffEvent
	now := time.Now().Unix()

	for key, ns := range newS {
		old, existed := oldS[key]
		switch {
		case !existed:
			out = append(out, wsclient.DiffEvent{
				TicketID: projectID, Key: key, Name: ns.Name,
				OldStatus: "", NewStatus: ns.Status, Timestamp: now,
				Price:       ns.Price,
				SaleStart:   ns.SaleStart,
				SaleEnd:     ns.SaleEnd,
				ScreenName:  ns.ScreenName,
				SubTicketID: ns.SubTicketID,
				LessVT:      ns.LessVT, // 【新增】
			})
		// 【修改】当售票状态发生变动，或者余票数量发生变动时，都将触发 Diff 事件上报
		case old.Status != ns.Status || old.LessVT != ns.LessVT:
			out = append(out, wsclient.DiffEvent{
				TicketID: projectID, Key: key, Name: ns.Name,
				OldStatus: old.Status, NewStatus: ns.Status, Timestamp: now,
				Price:       ns.Price,
				SaleStart:   ns.SaleStart,
				SaleEnd:     ns.SaleEnd,
				ScreenName:  ns.ScreenName,
				SubTicketID: ns.SubTicketID,
				LessVT:      ns.LessVT, // 【新增】
			})
		}
	}
	for key, old := range oldS {
		if _, stillExists := newS[key]; !stillExists {
			out = append(out, wsclient.DiffEvent{
				TicketID: projectID, Key: key, Name: old.Name,
				OldStatus: old.Status, NewStatus: "removed", Timestamp: now,
				Price:       old.Price,
				SaleStart:   old.SaleStart,
				SaleEnd:     old.SaleEnd,
				ScreenName:  old.ScreenName,
				SubTicketID: old.SubTicketID,
				LessVT:      -1, // 被移除时将余票值归为 -1
			})
		}
	}
	return out
}
