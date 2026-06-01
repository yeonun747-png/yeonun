import { NextResponse } from "next/server";

import { normalizeCloudwaysBaseUrl } from "@/lib/cloudways-base-url";
import { requireCloudwaysProxySecret } from "@/lib/internal-api-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function cloudwaysBaseUrl(): string {
  return normalizeCloudwaysBaseUrl(String(process.env.CLOUDWAYS_URL || process.env.NEXT_PUBLIC_CLOUDWAYS_URL || ""));
}

export async function POST(request: Request) {
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

  const body = await request.text().catch(() => "{}");
  const upstream = await fetch(`${base}/chat/voice/ai_speaking`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${proxySecret}`,
    },
    cache: "no-store",
    body,
  });

  const text = await upstream.text().catch(() => "");
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Cloudways voice ai_speaking failed", details: text.slice(0, 800) },
      { status: upstream.status || 502 },
    );
  }

  return new NextResponse(text || "{}", { headers: { "Content-Type": "application/json; charset=utf-8" } });
}

