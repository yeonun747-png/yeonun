import { NextResponse } from "next/server";

import { normalizeCloudwaysBaseUrl } from "@/lib/cloudways-base-url";
import { requireCloudwaysProxySecret } from "@/lib/internal-api-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function cloudwaysBaseUrl(): string {
  return normalizeCloudwaysBaseUrl(String(process.env.CLOUDWAYS_URL || process.env.NEXT_PUBLIC_CLOUDWAYS_URL || ""));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = String(url.searchParams.get("session_id") ?? "").trim();
  if (!sessionId) return NextResponse.json({ error: "session_id is required" }, { status: 400 });

  const base = cloudwaysBaseUrl();
  const proxySecret = requireCloudwaysProxySecret();
  if (!base) {
    return NextResponse.json(
      { error: "CLOUDWAYS_URL is not configured", hint: "Set CLOUDWAYS_URL or NEXT_PUBLIC_CLOUDWAYS_URL." },
      { status: 501 },
    );
  }
  if (!proxySecret) {
    return NextResponse.json({ error: "CLOUDWAYS_PROXY_SECRET is not configured" }, { status: 503 });
  }

  const upstream = await fetch(`${base}/chat/voice/events?session_id=${encodeURIComponent(sessionId)}`, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${proxySecret}`,
    },
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    const message = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "Cloudways voice events failed", details: message.slice(0, 800) },
      { status: upstream.status || 502 },
    );
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

