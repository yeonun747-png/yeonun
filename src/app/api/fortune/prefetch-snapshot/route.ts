import { NextResponse } from "next/server";

import { assertFortunePrefetchAccess } from "@/lib/consult-session-access";
import { readFortuneServerPrefetchSnapshot } from "@/lib/fortune-server-prefetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const request_id = String(searchParams.get("request_id") ?? "").trim();
  const access_token = String(searchParams.get("access_token") ?? "").trim();
  if (!request_id || !access_token) {
    return NextResponse.json({ error: "request_id and access_token required" }, { status: 400 });
  }

  const gate = await assertFortunePrefetchAccess(request, request_id, access_token);
  if (!gate.ok) return gate.response;

  const snap = await readFortuneServerPrefetchSnapshot(request_id);
  return NextResponse.json(snap);
}
