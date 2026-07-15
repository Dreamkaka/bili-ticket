/**
 * 从 worker 目录加载环境变量：
 *   .env → .env.local → .dev.vars（仅补缺）
 * 供 sync-dev-vars / run-dev 共用。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const workerRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/**
 * @param {string} filePath
 * @param {Map<string, string>} vars
 * @param {{ onlyFillMissing?: boolean }} [opts]
 */
export function parseEnvFile(filePath, vars, opts = {}) {
  if (!fs.existsSync(filePath)) return false;
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || key.startsWith("#")) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (opts.onlyFillMissing && vars.has(key)) continue;
    vars.set(key, value);
  }
  return true;
}

/** @returns {{ vars: Map<string, string>, sources: string[] }} */
export function loadWorkerEnv() {
  /** @type {Map<string, string>} */
  const vars = new Map();
  const sources = [];

  for (const name of [".env", ".env.local"]) {
    const p = path.join(workerRoot, name);
    if (parseEnvFile(p, vars)) sources.push(name);
  }

  const devVarsPath = path.join(workerRoot, ".dev.vars");
  if (fs.existsSync(devVarsPath)) {
    parseEnvFile(devVarsPath, vars, { onlyFillMissing: true });
  }

  return { vars, sources };
}

export function writeDevVars(vars, sources) {
  const outFile = path.join(workerRoot, ".dev.vars");
  const body =
    `# Auto-generated from ${sources.length ? sources.join(" + ") : "(empty)"} — do not edit by hand\n` +
    `# Run: npm run dev\n` +
    [...vars.entries()].map(([k, v]) => `${k}=${v}`).join("\n") +
    "\n";
  fs.writeFileSync(outFile, body, "utf8");
  return outFile;
}
