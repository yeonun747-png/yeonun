import { NextResponse } from "next/server";

import { optionalMyUserId } from "@/lib/my-route-auth";
import { checkRateLimitAsync, clientIpFromRequest } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VISITOR_RE = /^visitor_[0-9a-f-]{8,}$/i;

function normalizePath(raw: string): string | null {
  const path = String(raw ?? "").trim();
  if (!path || !path.startsWith("/") || path.length > 512) return null;
  if (path.startsWith("/admin") || path.startsWith("/api/")) return null;
  return path;
}

function resolveVisitorRef(authUserId: string | null, headerRef: string | null, bodyRef: string | null): string | null {
  if (authUserId && UUID_RE.test(authUserId)) return authUserId;
  const candidate = String(headerRef ?? bodyRef ?? "").trim();
  if (VISITOR_RE.test(candidate)) return candidate;
  return null;
}

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  if (!(await checkRateLimitAsync(`page-view:ip:${ip}`, 180, 60 * 60 * 1000))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { path?: string; visitor_ref?: string };
  const path = normalizePath(body.path ?? "");
  if (!path) {
    return NextResponse.json({ ok: false, error: "invalid_path" }, { status: 400 });
  }

  const authUserId = await optionalMyUserId(request);
  const headerRef = request.headers.get("x-yeonun-visitor-ref");
  const visitorRef = resolveVisitorRef(authUserId, headerRef, body.visitor_ref ?? null);
  if (!visitorRef) {
    return NextResponse.json({ ok: false, error: "invalid_visitor" }, { status: 400 });
  }

  if (!(await checkRateLimitAsync(`page-view:ref:${visitorRef}`, 120, 60 * 60 * 1000))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const sb = supabaseServer();
  const { error } = await sb.from("site_visit_events").insert({ visitor_ref: visitorRef, path });
  if (error) {
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
