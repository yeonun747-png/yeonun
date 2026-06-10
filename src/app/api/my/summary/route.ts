import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getProductsBySlugs } from "@/lib/data/content";
import { env } from "@/lib/env";
import { listFortuneLibraryItems } from "@/lib/library-fortune";
import {
  DEFAULT_LIBRARY_RETENTION,
  isLibraryRetentionValid,
  parseLibraryRetentionFromProduct,
} from "@/lib/library-retention";

export const dynamic = "force-dynamic";

export type MySummaryPayload = {
  ok: true;
  consultationCount: number;
  archiveCount: number;
  hasCreditPurchaseHistory: boolean;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceKey = env.supabaseServiceRoleKey;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  const supabase = createClient(env.supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });
  }

  const uid = userData.user.id;

  const { count: consultationCount, error: vErr } = await supabase
    .from("voice_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_ref", uid)
    .eq("status", "ended")
    .not("ended_at", "is", null);

  if (vErr) {
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }

  let archiveCount = 0;
  try {
    const rows = await listFortuneLibraryItems(uid);
    const slugs = [...new Set(rows.map((r) => r.product_slug).filter(Boolean))] as string[];
    const products = slugs.length ? await getProductsBySlugs(slugs) : [];
    const retentionBySlug = Object.fromEntries(
      products.map((p) => [p.slug, parseLibraryRetentionFromProduct(p)]),
    );
    for (const row of rows) {
      const slug = row.product_slug?.trim() ?? "";
      const policy = retentionBySlug[slug] ?? DEFAULT_LIBRARY_RETENTION;
      const when = row.completed_at || row.created_at;
      if (isLibraryRetentionValid(when, policy)) archiveCount += 1;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }

  const { data: orders, error: oErr } = await supabase.from("orders").select("id, amount_krw, product_slug").eq("user_ref", uid);

  if (oErr) {
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }

  const orderIds = (orders ?? []).map((o) => o.id).filter(Boolean);
  let hasCreditPurchaseHistory = false;

  if (orderIds.length > 0) {
    const { data: pays, error: pErr } = await supabase
      .from("payments")
      .select("paid_at, order_id")
      .in("order_id", orderIds)
      .not("paid_at", "is", null);

    if (!pErr) {
      const paidOrderIds = new Set((pays ?? []).map((p) => p.order_id).filter(Boolean));
      const creditAmounts = new Set([3900, 9900, 17900]);
      hasCreditPurchaseHistory = (orders ?? []).some((o) => {
        if (!paidOrderIds.has(o.id)) return false;
        const slug = (o.product_slug ?? "").toLowerCase();
        if (slug.includes("credit")) return true;
        return creditAmounts.has(Number(o.amount_krw) || 0);
      });
    }
  }

  const payload: MySummaryPayload = {
    ok: true,
    consultationCount: consultationCount ?? 0,
    archiveCount,
    hasCreditPurchaseHistory,
  };

  return NextResponse.json(payload);
}
