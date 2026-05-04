import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const MS_12M = 365 * 24 * 60 * 60 * 1000;

export type MyPaymentApiRow = {
  kind: "payment" | "refund";
  id: string;
  orderId: string;
  orderNo: string;
  productSlug: string;
  title: string;
  paidAt: string | null;
  method: string;
  amountKrw: number;
  paymentStatus: string;
  refundStatus?: string;
};

export type MyPaymentsPayload = {
  ok: true;
  rows: MyPaymentApiRow[];
  yearTotalKrw: number;
  monthTotalKrw: number;
};

function titleFromPayload(raw: unknown, slug: string): string {
  const t =
    raw && typeof raw === "object" && "title" in raw ? String((raw as { title?: string }).title ?? "").trim() : "";
  if (t) return t;
  if (slug.startsWith("credit-package")) {
    if (slug.includes("basic")) return "크레딧 기본 충전";
    if (slug.includes("popular")) return "크레딧 인기 패키지";
    if (slug.includes("premium")) return "크레딧 프리미엄 패키지";
    return "크레딧 충전";
  }
  return slug.replace(/-/g, " ");
}

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
  const cutoff = new Date(Date.now() - MS_12M).toISOString();

  const { data: orderRows, error: oErr } = await supabase
    .from("orders")
    .select("id, order_no, product_slug, amount_krw, created_at")
    .eq("user_ref", uid);

  if (oErr) {
    console.warn("[my/payments] orders", oErr.message);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }

  const orders = orderRows ?? [];
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const orderIds = orders.map((o) => o.id).filter(Boolean);

  if (orderIds.length === 0) {
    const empty: MyPaymentsPayload = { ok: true, rows: [], yearTotalKrw: 0, monthTotalKrw: 0 };
    return NextResponse.json(empty);
  }

  const { data: payRows, error: pErr } = await supabase
    .from("payments")
    .select("id, order_id, method, status, paid_at, raw_payload")
    .in("order_id", orderIds)
    .eq("status", "paid")
    .not("paid_at", "is", null)
    .gte("paid_at", cutoff)
    .order("paid_at", { ascending: false });

  if (pErr) {
    console.warn("[my/payments] payments", pErr.message);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }

  const payments = payRows ?? [];
  const paymentIds = payments.map((p) => p.id);

  let refundRows: {
    id: string;
    payment_id: string | null;
    amount_krw: number;
    status: string;
    processed_at: string | null;
    created_at: string;
  }[] = [];

  if (paymentIds.length > 0) {
    const { data: rData, error: rErr } = await supabase
      .from("refunds")
      .select("id, payment_id, amount_krw, status, processed_at, created_at")
      .in("payment_id", paymentIds);

    if (rErr) {
      console.warn("[my/payments] refunds", rErr.message);
    } else {
      refundRows = rData ?? [];
    }
  }

  const now = new Date();
  const y0 = now.getFullYear();
  const m0 = now.getMonth();

  let yearTotalKrw = 0;
  let monthTotalKrw = 0;

  const paymentApiRows: MyPaymentApiRow[] = [];

  for (const p of payments) {
    const ord = p.order_id ? orderMap.get(p.order_id) : undefined;
    if (!ord) continue;

    const paidAt = p.paid_at;
    if (paidAt) {
      const d = new Date(paidAt);
      if (Number.isFinite(d.getTime())) {
        if (d.getFullYear() === y0) yearTotalKrw += ord.amount_krw;
        if (d.getFullYear() === y0 && d.getMonth() === m0) monthTotalKrw += ord.amount_krw;
      }
    }

    paymentApiRows.push({
      kind: "payment",
      id: p.id,
      orderId: ord.id,
      orderNo: ord.order_no,
      productSlug: ord.product_slug ?? "",
      title: titleFromPayload(p.raw_payload, ord.product_slug ?? ""),
      paidAt,
      method: p.method ?? "card",
      amountKrw: ord.amount_krw,
      paymentStatus: p.status ?? "paid",
    });
  }

  const paymentById = new Map(payments.map((p) => [p.id, p]));

  const refundApiRows: MyPaymentApiRow[] = [];
  for (const r of refundRows) {
    if (!r.payment_id) continue;
    const pay = paymentById.get(r.payment_id);
    if (!pay || !pay.order_id) continue;
    const ord = orderMap.get(pay.order_id);
    if (!ord) continue;

    const refunded = Math.abs(Number(r.amount_krw) || 0);
    const ts = r.processed_at ?? r.created_at;
    if (new Date(ts) < new Date(cutoff)) continue;

    refundApiRows.push({
      kind: "refund",
      id: r.id,
      orderId: ord.id,
      orderNo: ord.order_no,
      productSlug: ord.product_slug ?? "",
      title: `환불 · ${titleFromPayload(pay.raw_payload, ord.product_slug ?? "")}`,
      paidAt: ts,
      method: pay.method ?? "card",
      amountKrw: -refunded,
      paymentStatus: pay.status ?? "paid",
      refundStatus: r.status,
    });

    const d = new Date(ts);
    if (Number.isFinite(d.getTime())) {
      if (d.getFullYear() === y0) yearTotalKrw += -refunded;
      if (d.getFullYear() === y0 && d.getMonth() === m0) monthTotalKrw += -refunded;
    }
  }

  const rows = [...paymentApiRows, ...refundApiRows].sort((a, b) => {
    const ta = new Date(a.paidAt ?? 0).getTime();
    const tb = new Date(b.paidAt ?? 0).getTime();
    return tb - ta;
  });

  const payload: MyPaymentsPayload = {
    ok: true,
    rows,
    yearTotalKrw,
    monthTotalKrw,
  };

  return NextResponse.json(payload);
}
