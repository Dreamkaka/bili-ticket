/**
 * 本地开发入口：
 * 1. 读取 .env / .env.local
 * 2. 写入 .dev.vars（Wrangler 标准注入）
 * 3. 再通过 wrangler --var 显式注入，避免 .dev.vars 未生效
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { loadWorkerEnv, writeDevVars, workerRoot } from "./load-env.mjs";

const { vars, sources } = loadWorkerEnv();

if (vars.size === 0) {
  console.error(
    "[run-dev] 未找到 .env / .env.local。请创建 worker/.env.local，例如:\n  GATEWAY_HTTP_URL=http://127.0.0.1:3000",
  );
  process.exit(1);
}

if (!vars.get("GATEWAY_HTTP_URL")?.trim()) {
  console.error(
    "[run-dev] GATEWAY_HTTP_URL 未设置。请在 worker/.env.local 中配置。",
  );
  process.exit(1);
}

writeDevVars(vars, sources);
console.log(
  `[run-dev] env from [${sources.join(", ")}]: GATEWAY_HTTP_URL=${vars.get("GATEWAY_HTTP_URL")}`,
);

const wranglerJs = path.join(
  workerRoot,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
);

/** 需要注入到 Worker 的键（非注释） */
const injectKeys = [
  "GATEWAY_HTTP_URL",
  "PROBE_TOKEN",
  "NODE_NAME",
  "PROBE_USER_AGENT",
  "CORE_IDS",
  "SHARD_IDS",
  "TARGETS_TTL_SEC",
  "HEARTBEAT_EVERY_N_RUNS",
  "MAX_CONCURRENCY",
];

const args = [wranglerJs, "dev", "--test-scheduled"];
for (const key of injectKeys) {
  const val = vars.get(key);
  if (val !== undefined && val !== "") {
    // wrangler --var KEY:VALUE
    args.push("--var", `${key}:${val}`);
  }
}

// 透传用户额外参数: npm run dev -- --port 8788
const extra = process.argv.slice(2);
args.push(...extra);

const child = spawn(process.execPath, args, {
  cwd: workerRoot,
  stdio: "inherit",
  env: process.env,
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
