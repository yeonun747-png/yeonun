import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function cloudwaysBaseUrl(): string {
  const v = String(process.env.CLOUDWAYS_URL || process.env.NEXT_PUBLIC_CLOUDWAYS_URL || "").replace(/\/$/, "");
  return v;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = String(url.searchParams.get("session_id") ?? "").trim();
  if (!sessionId) return NextResponse.json({ error: "session_id is required" }, { status: 400 });

  const base = cloudwaysBaseUrl();
  if (!base) {
    return NextResponse.json(
      { error: "CLOUDWAYS_URL is not configured", hint: "Set CLOUDWAYS_URL or NEXT_PUBLIC_CLOUDWAYS_URL." },
      { status: 501 },
    );
  }

  const upstream = await fetch(`${base}/chat/voice/events?session_id=${encodeURIComponent(sessionId)}`, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      ...(process.env.CLOUDWAYS_PROXY_SECRET ? { Authorization: `Bearer ${process.env.CLOUDWAYS_PROXY_SECRET}` } : {}),
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

