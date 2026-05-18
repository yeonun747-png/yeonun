import { NextResponse } from "next/server";

import { readFortuneServerPrefetchSnapshot } from "@/lib/fortune-server-prefetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const request_id = String(searchParams.get("request_id") ?? "").trim();
  if (!request_id) {
    return NextResponse.json({ error: "request_id required" }, { status: 400 });
  }

  const snap = await readFortuneServerPrefetchSnapshot(request_id);
  return NextResponse.json(snap);
}
