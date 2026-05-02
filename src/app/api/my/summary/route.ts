import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const LIBRARY_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

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
    console.warn("[my/summary] voice_sessions", vErr.message);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }

  const cutoffMs = Date.now() - LIBRARY_RETENTION_MS;

  const { data: reqRows, error: fErr } = await supabase
    .from("fortune_requests")
    .select("id")
    .eq("user_ref", uid)
    .eq("status", "completed")
    .contains("payload", { source: "fortune_stream_modal" });

  if (fErr) {
    console.warn("[my/summary] fortune_requests", fErr.message);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }

  const reqIds = (reqRows ?? []).map((r) => r.id).filter(Boolean);
  let archiveCount = 0;

  if (reqIds.length > 0) {
    const { data: results, error: resErr } = await supabase
      .from("fortune_results")
      .select("completed_at")
      .in("request_id", reqIds);

    if (resErr) {
      console.warn("[my/summary] fortune_results", resErr.message);
      return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
    }

    for (const r of results ?? []) {
      const t = r.completed_at ? Date.parse(r.completed_at) : NaN;
      if (Number.isFinite(t) && t >= cutoffMs) archiveCount += 1;
    }
  }

  const { data: orders, error: oErr } = await supabase.from("orders").select("id, amount_krw, product_slug").eq("user_ref", uid);

  if (oErr) {
    console.warn("[my/summary] orders", oErr.message);
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

    if (pErr) {
      console.warn("[my/summary] payments", pErr.message);
    } else {
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
