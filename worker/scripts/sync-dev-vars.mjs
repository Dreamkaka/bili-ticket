/**
 * Wrangler 本地只注入 .dev.vars，不会读 .env / .env.local。
 * 把 .env + .env.local 合并写入 .dev.vars。
 */
import { loadWorkerEnv, writeDevVars } from "./load-env.mjs";

const { vars, sources } = loadWorkerEnv();

if (vars.size === 0) {
  console.warn(
    "[sync-dev-vars] 未找到任何变量。请在 worker/.env 或 worker/.env.local 中设置 GATEWAY_HTTP_URL",
  );
  process.exit(0);
}

if (!vars.get("GATEWAY_HTTP_URL")) {
  console.warn(
    "[sync-dev-vars] 警告: GATEWAY_HTTP_URL 为空。示例: GATEWAY_HTTP_URL=http://127.0.0.1:3000",
  );
}

writeDevVars(vars, sources);
console.log(
  `[sync-dev-vars] wrote .dev.vars from [${sources.join(", ") || "none"}]: ${[...vars.keys()].join(", ")}`,
);
if (vars.get("GATEWAY_HTTP_URL")) {
  console.log(
    `[sync-dev-vars] GATEWAY_HTTP_URL=${vars.get("GATEWAY_HTTP_URL")}`,
  );
}
