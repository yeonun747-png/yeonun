import { NextResponse } from "next/server";

import { getNoticeReadSlugs, markNoticeReadForUser, mergeNoticeReadSlugs } from "@/lib/notice-reads-server";
import { requireMyUserId } from "@/lib/my-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  try {
    const slugs = await getNoticeReadSlugs(auth.userId);
    return NextResponse.json({ ok: true, slugs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { slug?: string; slugs?: string[] };

  try {
    if (Array.isArray(body.slugs) && body.slugs.length > 0) {
      const slugs = await mergeNoticeReadSlugs(auth.userId, body.slugs);
      return NextResponse.json({ ok: true, slugs });
    }
    const slug = String(body.slug ?? "").trim();
    if (!slug) {
      return NextResponse.json({ ok: false, error: "slug_required" }, { status: 400 });
    }
    const slugs = await markNoticeReadForUser(auth.userId, slug);
    return NextResponse.json({ ok: true, slugs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "save_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
