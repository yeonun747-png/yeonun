import { NextResponse } from "next/server";

import { findFortuneLibraryDuplicate } from "@/lib/library-fortune-duplicate";
import { optionalMyUserId } from "@/lib/my-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const product_slug = String(url.searchParams.get("product_slug") ?? "").trim();
  const saju_fingerprint = String(url.searchParams.get("saju_fingerprint") ?? "").trim();

  if (!product_slug || !saju_fingerprint) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }

  const userId = await optionalMyUserId(request);
  if (!userId) {
    return NextResponse.json({ ok: true as const, duplicate: false as const });
  }

  try {
    const hit = await findFortuneLibraryDuplicate(userId, product_slug, saju_fingerprint);
    if (!hit) {
      return NextResponse.json({ ok: true as const, duplicate: false as const });
    }
    return NextResponse.json({
      ok: true as const,
      duplicate: true as const,
      request_id: hit.request_id,
      viewed_at: hit.viewed_at,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "duplicate_check_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
