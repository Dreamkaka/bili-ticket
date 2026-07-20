import type { Env } from "./types";

// 内存 Fallback 缓存，供 ESA 没有绑定 Edge KV 时使用
const memoryCache = new Map<string, string>();

export class AdaptiveKV {
  constructor(private env: Env) {}

  /**
   * 获取缓存值
   */
  async get(key: string): Promise<string | null> {
    if (this.env.PROBE_STATE) {
      try {
        return await this.env.PROBE_STATE.get(key);
      } catch (err) {
        console.warn(`[KV] ESA Edge KV read failed, fallback to memory. error:`, err);
      }
    }
    return memoryCache.get(key) || null;
  }

  /**
   * 获取 JSON 缓存值
   */
  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error(`[KV] Failed to parse JSON for key ${key}:`, err);
      return null;
    }
  }

  /**
   * 写入缓存值
   */
  async put(key: string, value: string): Promise<void> {
    if (this.env.PROBE_STATE) {
      try {
        await this.env.PROBE_STATE.put(key, value);
        return;
      } catch (err) {
        console.warn(`[KV] ESA Edge KV write failed, fallback to memory. error:`, err);
      }
    }
    memoryCache.set(key, value);
  }
}
