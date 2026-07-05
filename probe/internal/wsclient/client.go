package wsclient

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type MessageType string

const (
	TypeRegister MessageType = "register"
	TypeDiff     MessageType = "diff"
)

type Envelope struct {
	Type MessageType     `json:"type"`
	Data json.RawMessage `json:"data"`
}

type RegisterPayload struct {
	NodeName string `json:"node_name"`
}

type NodeStatusPayload struct {
	Status   string `json:"status"` // 可选值: "healthy" | "risk_control" | "error"
	HTTPCode int    `json:"http_code"`
	Message  string `json:"message"`
}

type DiffEvent struct {
	TicketID    string `json:"ticket_id"`
	Key         string `json:"key"`
	Name        string `json:"name"`
	OldStatus   string `json:"old_status"`
	NewStatus   string `json:"new_status"`
	Timestamp   int64  `json:"ts"`
	Price       int    `json:"price"`
	SaleStart   int64  `json:"sale_start"`
	SaleEnd     int64  `json:"sale_end"`
	ScreenName  string `json:"screen_name"`
	SubTicketID int    `json:"sub_ticket_id"`
	LessVT      int    `json:"less_vt"`
}

// =========================
// FIX: assignment handler
// =========================
type AssignmentHandler func(coreIDs, shardIDs []string, interval int)

type Client struct {
	url      string
	nodeName string

	mu   sync.Mutex
	conn *websocket.Conn

	sendCh chan Envelope

	onAssignment AssignmentHandler
}

// =========================
// constructor
// =========================
func New(url, nodeName string) *Client {
	return &Client{
		url:      url,
		nodeName: nodeName,
		sendCh:   make(chan Envelope, 256),
	}
}

// =========================
// handler setter
// =========================
func (c *Client) SetAssignmentHandler(h AssignmentHandler) {
	c.onAssignment = h
}

// ReportStatus 用于向 Gateway 上报当前节点的健康状况和 HTTP 状态码
func (c *Client) ReportStatus(status string, httpCode int, errMsg string) {
	payload := NodeStatusPayload{
		Status:   status,
		HTTPCode: httpCode,
		Message:  errMsg,
	}
	data, _ := json.Marshal(payload)

	select {
	case c.sendCh <- Envelope{
		Type: "node_status",
		Data: data,
	}:
	default:
		log.Println("send buffer full, dropping status update")
	}
}

// =========================
// main loop
// =========================
func (c *Client) Run() {
	backoff := time.Second
	maxBackoff := 30 * time.Second

	for {
		log.Println("connecting to gateway...")

		err := c.connect()
		if err != nil {
			log.Println("connect failed:", err)
		} else {
			log.Println("connection closed")
		}

		time.Sleep(backoff)
		if backoff < maxBackoff {
			backoff *= 2
		}
	}
}

// =========================
// connect
// =========================
func (c *Client) connect() error {
	conn, _, err := websocket.DefaultDialer.Dial(c.url, nil)
	if err != nil {
		return err
	}

	c.setConn(conn)
	defer c.closeConn()

	// =========================
	// register
	// =========================
	register := Envelope{
		Type: TypeRegister,
		Data: mustMarshal(RegisterPayload{
			NodeName: c.nodeName,
		}),
	}

	if err := conn.WriteJSON(register); err != nil {
		return err
	}

	log.Printf("registered node: %s", c.nodeName)

	readDone := make(chan error, 1)

	// =========================
	// read loop
	// =========================
	go func() {
		for {
			var env Envelope
			if err := conn.ReadJSON(&env); err != nil {
				readDone <- err
				return
			}
			c.handle(env)
		}
	}()

	// =========================
	// write loop
	// =========================
	for {
		select {
		case err := <-readDone:
			return err

		case msg := <-c.sendCh:
			if err := conn.WriteJSON(msg); err != nil {
				return err
			}
		}
	}
}

// =========================
// handle server msg
// =========================
func (c *Client) handle(env Envelope) {
	switch env.Type {

	case "assignment":
		var payload struct {
			CoreIDs        []string `json:"core_ids"`
			ShardIDs       []string `json:"shard_ids"`
			PollIntervalMs int      `json:"poll_interval_ms"`
		}

		if err := json.Unmarshal(env.Data, &payload); err != nil {
			log.Println("bad assignment:", err)
			return
		}

		log.Printf("assignment received: %d cores, %d shards",
			len(payload.CoreIDs), len(payload.ShardIDs))

		if c.onAssignment != nil {
			c.onAssignment(payload.CoreIDs, payload.ShardIDs, payload.PollIntervalMs)
		}

	case "reassignment":
		log.Println("reassignment received")
		var payload struct {
			CoreIDs        []string `json:"core_ids"`
			ShardIDs       []string `json:"shard_ids"`
			PollIntervalMs int      `json:"poll_interval_ms"`
		}

		if err := json.Unmarshal(env.Data, &payload); err != nil {
			log.Println("bad reassignment:", err)
			return
		}

		log.Printf("reassignment received: %d cores, %d shards",
			len(payload.CoreIDs), len(payload.ShardIDs))

		if c.onAssignment != nil {
			c.onAssignment(payload.CoreIDs, payload.ShardIDs, payload.PollIntervalMs)
		}

	default:
		log.Println("unknown message:", env.Type)
	}
}

// =========================
// send diffs
// =========================
func (c *Client) SendDiffs(events []DiffEvent) {
	data, _ := json.Marshal(events)

	select {
	case c.sendCh <- Envelope{
		Type: TypeDiff,
		Data: data,
	}:
	default:
		log.Println("send buffer full, dropping diff batch")
	}
}

// =========================
// helpers
// =========================
func (c *Client) setConn(conn *websocket.Conn) {
	c.mu.Lock()
	c.conn = conn
	c.mu.Unlock()
}

func (c *Client) closeConn() {
	c.mu.Lock()
	if c.conn != nil {
		c.conn.Close()
		c.conn = nil
	}
	c.mu.Unlock()
}

func mustMarshal(v any) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}
