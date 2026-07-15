package config

import (
	"bufio"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Config holds all runtime settings, populated from environment variables
// so the same binary works locally, in Docker, and as a k8s DaemonSet.
type Config struct {
	NodeName     string
	GatewayWSURL string
	UserAgent    string
	// ProbeToken is the shared secret for Gateway WS auth (Authorization: Bearer).
	// Empty means the probe will not send a token (dev mode when gateway also has none).
	ProbeToken string
}

func Load() Config {
	// 本地开发：从 cwd / probe 子目录 / 含 go.mod 的目录加载 .env（不覆盖已有非空环境变量）
	loadDotEnv()

	return Config{
		// NODE_NAME should be injected via the Downward API (spec.nodeName)
		NodeName:     getEnv("NODE_NAME", "unknown-node"),
		GatewayWSURL: getEnv("GATEWAY_WS_URL", "ws://localhost:3000/ws/probe"),
		UserAgent:    getEnv("PROBE_USER_AGENT", "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 "),
		ProbeToken:   getEnv("PROBE_TOKEN", ""),
	}
}

func loadDotEnv() {
	seen := map[string]struct{}{}
	for _, path := range envFileCandidates() {
		if path == "" {
			continue
		}
		abs, err := filepath.Abs(path)
		if err != nil {
			abs = path
		}
		if _, ok := seen[abs]; ok {
			continue
		}
		seen[abs] = struct{}{}
		if loadEnvFile(abs) {
			log.Printf("loaded env file: %s", abs)
		}
	}
}

func envFileCandidates() []string {
	names := []string{".env", ".env.local"}
	var out []string

	add := func(dir string) {
		if dir == "" {
			return
		}
		for _, name := range names {
			out = append(out, filepath.Join(dir, name))
		}
	}

	if wd, err := os.Getwd(); err == nil {
		add(wd)
		// 从仓库根目录启动时：F:\pyhq\probe\.env
		add(filepath.Join(wd, "probe"))
		// 向上查找 go.mod 所在目录（probe 模块根）
		dir := wd
		for i := 0; i < 8; i++ {
			if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
				add(dir)
			}
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}

	if ex, err := os.Executable(); err == nil {
		add(filepath.Dir(ex))
	}

	return out
}

// loadEnvFile 解析简单 KEY=VALUE 文件；已有非空环境变量不覆盖。
// 返回是否成功打开并解析了文件。
func loadEnvFile(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	first := true
	for scanner.Scan() {
		line := scanner.Text()
		if first {
			// 去掉 UTF-8 BOM
			line = strings.TrimPrefix(line, "\ufeff")
			first = false
		}
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "export ") {
			line = strings.TrimSpace(strings.TrimPrefix(line, "export "))
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)
		if len(val) >= 2 {
			if (val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'') {
				val = val[1 : len(val)-1]
			}
		}
		if key == "" {
			continue
		}
		// 仅当现有值为空时才写入（避免空字符串占位导致 .env 失效）
		if os.Getenv(key) != "" {
			continue
		}
		_ = os.Setenv(key, val)
	}
	return true
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
