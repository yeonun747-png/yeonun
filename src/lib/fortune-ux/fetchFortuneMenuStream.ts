"use client";

import {
  logFortuneStreamFallback,
  logFortuneStreamPathChosen,
  logFortuneStreamSessionUpstream,
  resetFortuneHybridStreamDebug,
} from "@/lib/fortune-hybrid-stream-debug";
import { orderAccessHeaders } from "@/lib/order-access-client";

export type FortuneMenuStreamBody = {
  product_slug: string;
  profile: string;
  character_key: string;
  order_no?: string;
  title: string;
  manse_ryeok_text: string;
  user_info: Record<string, string | undefined>;
  partner_info: Record<string, string | undefined> | null;
  fortune_extra_context?: string;
};

type StreamSessionJson = {
  mode?: "direct" | "proxy";
  request_id?: string | null;
  stream_url?: string;
  stream_token?: string;
  stream_pass?: string;
  upstream_body?: Record<string, unknown>;
};

const streamHeaders = (orderNo?: string) =>
  ({
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    ...orderAccessHeaders(orderNo),
  }) as const;

function isEventStream(res: Response): boolean {
  return res.ok && !!res.body && (res.headers.get("content-type") ?? "").toLowerCase().includes("text/event-stream");
}

/**
 * reunionf82 패턴: stream-session → (가능하면) Cloudways 직접 SSE, 아니면 stream-proxy.
 * 실패 시 레거시 chat-stream-menus.
 */
export async function fetchFortuneMenuStream(
  streamBody: FortuneMenuStreamBody,
  signal: AbortSignal,
): Promise<Response> {
  resetFortuneHybridStreamDebug("fetchFortuneMenuStream");
  const hdrs = streamHeaders(streamBody.order_no);
  let session: StreamSessionJson | null = null;
  try {
    const sessionRes = await fetch("/api/fortune/stream-session", {
      method: "POST",
      headers: hdrs,
      body: JSON.stringify(streamBody),
      signal,
    });
    if (sessionRes.ok) {
      session = (await sessionRes.json()) as StreamSessionJson;
      logFortuneStreamSessionUpstream(session.upstream_body, { streamPath: "stream-session" });
    }
  } catch {
    session = null;
  }

  if (session?.mode === "direct" && session.stream_url && session.stream_token && session.upstream_body) {
    try {
      const directRes = await fetch(`${String(session.stream_url).replace(/\/+$/, "")}/chat`, {
        method: "POST",
        headers: {
          ...hdrs,
          Authorization: `Bearer ${session.stream_token}`,
        },
        body: JSON.stringify(session.upstream_body),
        signal,
      });
      if (isEventStream(directRes)) {
        logFortuneStreamPathChosen("Cloudways direct /chat (SSE)");
        return directRes;
      }
    } catch {
      /* 브라우저 → Cloudways 직접 연결 실패(CORS·네트워크) — 아래 stream-proxy로 폴백 */
    }
  }

  if (session?.upstream_body) {
    logFortuneStreamPathChosen("/api/fortune/stream-proxy (SSE)");
    const streamPass = String(session.stream_pass ?? "").trim();
    const proxyHdrs = streamPass ? { ...hdrs, "x-fortune-stream-pass": streamPass } : hdrs;
    const proxyRes = await fetch("/api/fortune/stream-proxy", {
      method: "POST",
      headers: proxyHdrs,
      body: JSON.stringify({
        request_id: session.request_id ?? undefined,
        upstream_body: session.upstream_body,
      }),
      signal,
    });
    if (isEventStream(proxyRes)) return proxyRes;
  }

  logFortuneStreamFallback("chat-stream-menus");
  return fetch("/api/fortune/chat-stream-menus", {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify(streamBody),
    signal,
  });
}
