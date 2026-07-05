package config

import (
	"os"
	"strconv"
)

// Config holds all runtime settings, populated from environment variables
// so the same binary works locally, in Docker, and as a k8s DaemonSet.
type Config struct {
	NodeName     string
	GatewayWSURL string
	UserAgent    string
}

func Load() Config {
	return Config{
		// NODE_NAME should be injected via the Downward API (spec.nodeName)
		NodeName:     getEnv("NODE_NAME", "unknown-node"),
		GatewayWSURL: getEnv("GATEWAY_WS_URL", "ws://localhost:3000/ws/probe"),
		UserAgent:    getEnv("PROBE_USER_AGENT", "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 "),
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// kept for future use (e.g. tunable HTTP timeouts via env)
func getEnvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
