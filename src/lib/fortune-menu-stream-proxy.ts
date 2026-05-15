import { normalizeCloudwaysBaseUrl } from "@/lib/cloudways-base-url";
import type { FortuneMenuCloudwaysBody } from "@/lib/fortune-menu-stream-payload";

export function getCloudwaysFortuneBaseUrl(): string {
  return normalizeCloudwaysBaseUrl(
    String(
      process.env.CLOUDWAYS_FORTUNE_URL ||
        process.env.CLOUDWAYS_URL ||
        process.env.NEXT_PUBLIC_CLOUDWAYS_URL ||
        "",
    ),
  );
}

export function getCloudwaysProxySecret(): string {
  return String(process.env.CLOUDWAYS_PROXY_SECRET || "");
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

/**
 * reunionf82 `stream-proxy` 패턴: 클라이언트 AbortSignal을 upstream에 넘기지 않고,
 * Cloudways SSE를 끝까지 읽으며 heartbeat으로 중계한다.
 */
export async function proxyFortuneMenuSseToResponse(
  upstreamBody: FortuneMenuCloudwaysBody,
  opts?: { clientSignal?: AbortSignal },
): Promise<Response> {
  const cloudwaysUrl = getCloudwaysFortuneBaseUrl();
  const cloudwaysSecret = getCloudwaysProxySecret();

  if (!cloudwaysUrl) {
    return Response.json({ error: "CLOUDWAYS_URL is not configured" }, { status: 501 });
  }

  const upstream = await fetch(`${cloudwaysUrl}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(cloudwaysSecret ? { Authorization: `Bearer ${cloudwaysSecret}` } : {}),
    },
    cache: "no-store",
    body: JSON.stringify(upstreamBody),
  });

  if (!upstream.ok || !upstream.body) {
    const details = await upstream.text().catch(() => "");
    return Response.json(
      { error: "fortune_menu_upstream_failed", details: details.slice(0, 2000) },
      { status: upstream.status || 502 },
    );
  }

  const reader = upstream.body.getReader();
  const clientSignal = opts?.clientSignal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        controller.enqueue(encoder.encode(": connected\n\n"));
      } catch {
        /* ignore */
      }

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* ignore */
        }
      }, 10_000);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          try {
            controller.enqueue(value);
          } catch {
            /* 클라이언트 이탈 — upstream은 끝까지 drain (reunionf82 stream-proxy) */
          }
        }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      } catch (e) {
        try {
          controller.error(e);
        } catch {
          /* ignore */
        }
      } finally {
        clearInterval(heartbeat);
        reader.cancel().catch(() => {});
      }
    },
    cancel() {
      void clientSignal;
      /* ReadableStream cancel만으로 upstream fetch 중단하지 않음 */
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
