import { FANSTUDIO_ORIGIN, parseWindField } from "@/lib/fanstudio";

const TTL_MS = 15 * 60 * 1000;
let memo: { exp: number; body: unknown } | null = null;

export async function GET() {
  if (memo && memo.exp > Date.now()) {
    return Response.json(memo.body);
  }
  try {
    const res = await fetch(`${FANSTUDIO_ORIGIN}/we/wind_field.php`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const json: unknown = await res.json();
    if (!res.ok) {
      return Response.json({ error: `风场接口失败 (${res.status})` }, { status: 502 });
    }
    const field = parseWindField(json);
    if (!field) {
      return Response.json({ error: "风场数据格式无效" }, { status: 502 });
    }
    const body = { field };
    memo = { exp: Date.now() + TTL_MS, body };
    return Response.json(body);
  } catch (err) {
    console.error("wind field fetch failed:", err);
    return Response.json({ error: "风场数据网络错误" }, { status: 502 });
  }
}
