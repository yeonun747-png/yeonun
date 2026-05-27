import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getCharacterModePrompt, getCharacterPersona, getServicePrompt } from "@/lib/data/characters";
import { fulfillCreditTopupForPaidOrder, isLoggedInUserId } from "@/lib/credit-server";
import { consumeCheckoutCoupons } from "@/lib/mission-coupon-server";
import { env } from "@/lib/env";
import { checkFortune82PaymentStatus, isFortune82PaymentPaid } from "@/lib/payment-fortune82-pcheck";
import { ensureOrderPaidPaymentRecord } from "@/lib/payment-complete-db";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isCreditTopupProduct(product_slug: string) {
  return (
    product_slug.startsWith("credit-package") ||
    product_slug.includes("voice-credit") ||
    product_slug.startsWith("credit")
  );
}

function characterKeyForSlug(product_slug: string): string {
  if (["zimi-chart", "newyear-2026", "tojeong-2026", "zimi-2026-flow"].includes(product_slug)) return "byeol";
  if (["lifetime-master", "saju-classic", "wealth-graph", "career-timing"].includes(product_slug)) return "yeo";
  if (["naming-baby", "taekil-goodday", "dream-lastnight"].includes(product_slug)) return "un";
  return "yeon";
}

async function applyCheckoutCouponsIfNeeded(
  order: { user_ref: string | null; amount_krw: number | null },
  payment: { raw_payload: unknown } | null,
) {
  if (!isLoggedInUserId(order.user_ref) || !payment?.raw_payload) return;
  const raw = payment.raw_payload as Record<string, unknown>;
  const discount = Number(raw.coupon_discount_krw ?? 0);
  if (discount <= 0) return;

  const serviceKey = env.supabaseServiceRoleKey;
  if (!serviceKey) return;

  const svc = createClient(env.supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await consumeCheckoutCoupons(svc, order.user_ref, {
    final_price_krw: Math.max(0, Number(order.amount_krw ?? 0)),
    discount_krw: discount,
    label: String(raw.coupon_label ?? ""),
    consume_discount_coupon_id:
      typeof raw.consume_discount_coupon_id === "string" ? raw.consume_discount_coupon_id : null,
    consume_dream_pass_id: typeof raw.consume_dream_pass_id === "string" ? raw.consume_dream_pass_id : null,
  });
}

/**
 * PG 성공 페이지에서 호출 — order_no(oid) 기준 결제 완료 처리
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { order_no?: string; oid?: string };
    const orderNo = String(body.order_no ?? body.oid ?? "").trim();
    if (!orderNo) {
      return NextResponse.json({ success: false, error: "주문번호가 없습니다." }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id,order_no,status,amount_krw,product_slug,user_ref")
      .eq("order_no", orderNo)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    const product_slug = String(order.product_slug ?? "");
    const isCreditTopup = isCreditTopupProduct(product_slug);
    const paidAt = new Date().toISOString();

    if (order.status === "paid") {
      const { payment: backfill } = await ensureOrderPaidPaymentRecord(supabase, order, paidAt);
      let credit_grant: { granted: boolean } | null = null;
      if (isCreditTopup && isLoggedInUserId(order.user_ref)) {
        const raw =
          backfill?.raw_payload && typeof backfill.raw_payload === "object"
            ? (backfill.raw_payload as Record<string, unknown>)
            : null;
        const grantResult = await fulfillCreditTopupForPaidOrder(order.user_ref, order, raw);
        credit_grant = { granted: grantResult.granted };
      }
      return NextResponse.json({
        success: true,
        order,
        payment: backfill,
        already_paid: true,
        credit_grant,
        pg_check: "Y",
      });
    }

    const pcheck = await checkFortune82PaymentStatus(orderNo);
    if (!isFortune82PaymentPaid(pcheck)) {
      return NextResponse.json(
        {
          success: false,
          error: "PG 결제가 완료되지 않았습니다.",
          pg_check: pcheck.code,
          pg_raw: pcheck.raw.slice(0, 200),
        },
        { status: 402 },
      );
    }

    const { payment, error: payErr } = await ensureOrderPaidPaymentRecord(supabase, order, paidAt);

    if (payErr) {
      return NextResponse.json({ success: false, error: payErr }, { status: 500 });
    }

    const { data: claimedOrder } = await supabase
      .from("orders")
      .update({ status: "paid" })
      .eq("id", order.id)
      .neq("status", "paid")
      .select("id,order_no,status,amount_krw,product_slug,user_ref")
      .maybeSingle();

    const orderPaid = claimedOrder ?? { ...order, status: "paid" as const };

    await applyCheckoutCouponsIfNeeded(orderPaid, payment);

    let credit_grant: { granted: boolean } | null = null;
    if (isCreditTopup && isLoggedInUserId(orderPaid.user_ref)) {
      const raw =
        payment?.raw_payload && typeof payment.raw_payload === "object"
          ? (payment.raw_payload as Record<string, unknown>)
          : null;
      const grantResult = await fulfillCreditTopupForPaidOrder(orderPaid.user_ref, orderPaid, raw);
      credit_grant = { granted: grantResult.granted };
    }

    let fortuneRequest = null;
    if (!isCreditTopup && product_slug) {
      const { data: existingFr } = await supabase
        .from("fortune_requests")
        .select("id,status")
        .eq("order_id", order.id)
        .maybeSingle();

      if (existingFr) {
        fortuneRequest = existingFr;
      } else {
        const character_key = characterKeyForSlug(product_slug);
        const [commonPrompt, characterPrompt, persona] = await Promise.all([
          getServicePrompt("yeonun_fortune_text_system"),
          getCharacterModePrompt(character_key, "fortune_text"),
          getCharacterPersona(character_key),
        ]);

        const { data: fr } = await supabase
          .from("fortune_requests")
          .insert({
            user_ref: orderPaid.user_ref ?? "guest",
            product_slug,
            order_id: order.id,
            status: "queued",
            model: "claude-4.6-sonnet",
            prompt_version_id: null,
            payload: {
              product_slug,
              order_no: order.order_no,
              payment_method: "pg",
              character_key,
              common_system_prompt: commonPrompt?.prompt ?? null,
              character_system_prompt: characterPrompt?.prompt ?? null,
              persona_snapshot: persona ?? null,
            },
          })
          .select("id,status")
          .maybeSingle();
        fortuneRequest = fr;
      }
    }

    await supabase.from("webhook_events").insert({
      provider: "fortune82-pg",
      event_type: "payment.complete",
      event_id: orderNo,
      payload: { order: orderPaid, payment, fortune_request: fortuneRequest, credit_grant },
      status: "processed",
      processed_at: paidAt,
    });

    return NextResponse.json({
      success: true,
      order: orderPaid,
      payment,
      fortune_request: fortuneRequest,
      is_credit_topup: isCreditTopup,
      credit_grant,
      pg_check: pcheck.code,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "결제 완료 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
