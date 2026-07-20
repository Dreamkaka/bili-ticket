import type { TicketState } from "./types.ts";

const API_URL =
  "https://show.bilibili.com/api/ticket/project/getV2?version=134&id={id}&project_id={id}";

export class HTTPError extends Error {
  constructor(
    public statusCode: number,
    public projectId: string,
  ) {
    super(`HTTP error ${statusCode} for project ${projectId}`);
    this.name = "HTTPError";
  }
}

export class APIError extends Error {
  constructor(
    public errno: number,
    public msg: string,
    public projectId: string,
  ) {
    super(`API error ${errno} for project ${projectId}: ${msg}`);
    this.name = "APIError";
  }
}

interface ApiResponse {
  errno?: number;
  msg?: string;
  code?: number;
  message?: string;
  success?: boolean;
  data?: {
    screen_list?: Array<{
      name: string;
      ticket_list?: Array<{
        id: number;
        desc: string;
        price: number;
        saleStart?: number;
        saleEnd?: number;
        sale_start?: number;
        sale_end?: number;
        less_vt?: number;
        sale_flag?: {
          number?: number;
          display_name?: string;
        };
      }>;
    }>;
  };
}

function bizCode(parsed: ApiResponse): number | undefined {
  if (typeof parsed.code === "number") return parsed.code;
  if (typeof parsed.errno === "number") return parsed.errno;
  return undefined;
}

function bizMsg(parsed: ApiResponse): string {
  return parsed.message || parsed.msg || "";
}

function isBizOk(parsed: ApiResponse): boolean {
  const code = bizCode(parsed);
  if (code !== undefined) return code === 0;
  if (typeof parsed.success === "boolean") return parsed.success;
  return Boolean(parsed.data);
}

function bilibiliHeaders(userAgent: string, sessdata?: string): Headers {
  const headers = new Headers();
  headers.set(
    "User-Agent",
    userAgent ||
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  );
  headers.set("Accept", "application/json, text/plain, */*");
  headers.set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8");
  headers.set("Referer", "https://show.bilibili.com/");
  headers.set("Origin", "https://show.bilibili.com");
  headers.set("Sec-Fetch-Dest", "empty");
  headers.set("Sec-Fetch-Mode", "cors");
  headers.set("Sec-Fetch-Site", "same-site");
  const cookie = (sessdata || "").trim();
  if (cookie) {
    headers.set("Cookie", `SESSDATA=${cookie}`);
  }
  return headers;
}

export async function fetchProjectStates(
  projectId: string,
  userAgent: string,
  sessdata?: string,
): Promise<Map<string, TicketState>> {
  const url = API_URL.replaceAll("{id}", encodeURIComponent(projectId));
  const resp = await fetch(url, {
    method: "GET",
    headers: bilibiliHeaders(userAgent, sessdata),
    redirect: "follow",
  });

  if (!resp.ok) {
    throw new HTTPError(resp.status, projectId);
  }

  const parsed = (await resp.json()) as ApiResponse;
  if (!isBizOk(parsed)) {
    const code = bizCode(parsed) ?? -1;
    throw new APIError(code, bizMsg(parsed), projectId);
  }

  const states = new Map<string, TicketState>();
  for (const screen of parsed.data?.screen_list || []) {
    for (const ticket of screen.ticket_list || []) {
      const key = `${screen.name}-${ticket.id}`;
      states.set(key, {
        key,
        name: `${screen.name} / ${ticket.desc}`,
        status: ticket.sale_flag?.display_name || "",
        price: ticket.price || 0,
        saleStart: ticket.saleStart ?? ticket.sale_start ?? 0,
        saleEnd: ticket.saleEnd ?? ticket.sale_end ?? 0,
        screenName: screen.name,
        subTicketId: ticket.id,
        lessVt: ticket.less_vt ?? -1,
      });
    }
  }
  return states;
}

export function isRiskControlError(err: unknown): boolean {
  if (err instanceof HTTPError) {
    return (
      err.statusCode === 412 ||
      err.statusCode === 403 ||
      err.statusCode === 429
    );
  }
  if (err instanceof APIError) {
    return err.errno === -412 || err.errno === 412;
  }
  return false;
}
