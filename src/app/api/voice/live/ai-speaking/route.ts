import { NextResponse } from "next/server";

import { normalizeCloudwaysBaseUrl } from "@/lib/cloudways-base-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function cloudwaysBaseUrl(): string {
  return normalizeCloudwaysBaseUrl(String(process.env.CLOUDWAYS_URL || process.env.NEXT_PUBLIC_CLOUDWAYS_URL || ""));
}

export async function POST(request: Request) {
  const base = cloudwaysBaseUrl();
  if (!base) {
    return NextResponse.json(
      { error: "CLOUDWAYS_URL is not configured", hint: "Set CLOUDWAYS_URL or NEXT_PUBLIC_CLOUDWAYS_URL." },
      { status: 501 },
    );
  }

  const body = await request.text().catch(() => "{}");
  const upstream = await fetch(`${base}/chat/voice/ai_speaking`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.CLOUDWAYS_PROXY_SECRET ? { Authorization: `Bearer ${process.env.CLOUDWAYS_PROXY_SECRET}` } : {}),
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

