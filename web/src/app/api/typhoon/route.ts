import { FANSTUDIO_ORIGIN, parseTyphoonPayload } from "@/lib/fanstudio";

const TTL_MS = 5 * 60 * 1000;
let memo: { exp: number; body: unknown } | null = null;

export async function GET() {
  if (memo && memo.exp > Date.now()) {
    return Response.json(memo.body);
  }
  try {
    const res = await fetch(`${FANSTUDIO_ORIGIN}/we/typhoon.php`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const json: unknown = await res.json();
    if (!res.ok) {
      return Response.json({ error: `台风接口失败 (${res.status})` }, { status: 502 });
    }
    if (json && typeof json === "object" && !Array.isArray(json) && "msg" in json) {
      const body = { storms: [], message: String((json as { msg: unknown }).msg) };
      memo = { exp: Date.now() + TTL_MS, body };
      return Response.json(body);
    }
    const body = { storms: parseTyphoonPayload(json), message: null };
    memo = { exp: Date.now() + TTL_MS, body };
    return Response.json(body);
  } catch (err) {
    console.error("typhoon fetch failed:", err);
    return Response.json({ error: "台风数据网络错误" }, { status: 502 });
  }
}
