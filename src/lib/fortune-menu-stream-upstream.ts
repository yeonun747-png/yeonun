import { getCloudwaysFortuneBaseUrl, getCloudwaysProxySecret } from "@/lib/fortune-menu-stream-proxy";
import type { FortuneMenuCloudwaysBody } from "@/lib/fortune-menu-stream-payload";

/** Cloudways `/chat` SSE — 클라이언트 AbortSignal 없이 끝까지 drain */
export async function fetchFortuneMenuStreamUpstream(
  upstreamBody: FortuneMenuCloudwaysBody,
): Promise<Response> {
  const cloudwaysUrl = getCloudwaysFortuneBaseUrl();
  const cloudwaysSecret = getCloudwaysProxySecret();

  if (!cloudwaysUrl) {
    return Response.json({ error: "CLOUDWAYS_URL is not configured" }, { status: 501 });
  }

  return fetch(`${cloudwaysUrl}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(cloudwaysSecret ? { Authorization: `Bearer ${cloudwaysSecret}` } : {}),
    },
    cache: "no-store",
    body: JSON.stringify(upstreamBody),
  });
}
