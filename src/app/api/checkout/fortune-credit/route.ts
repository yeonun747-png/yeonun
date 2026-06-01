import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { ageGateToNextResponse, assertUserAge14Plus } from "@/lib/age-policy";
import { spendCredits } from "@/lib/credit-server";
import { env } from "@/lib/env";
import {
  consumeCheckoutCoupons,
  getActiveDiscountCoupon,
  getActiveDreamPass,
  resolveCheckoutCouponApply,
} from "@/lib/mission-coupon-server";
import { requireMyUserId } from "@/lib/my-route-auth";
import { mintOrderAccessToken } from "@/lib/order-access";
import { generateOrderId } from "@/lib/payment-utils";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * 점사 크레딧 결제 — 크레딧 차감 + paid 주문·결제 생성(보관함 저장용 order_no).
 */
export async function POST(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  const gate = await assertUserAge14Plus(auth.userId);
  const denied = ageGateToNextResponse(gate);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    product_slug?: string;
    title?: string;
  };

  const product_slug = String(body.product_slug ?? "").trim();
  if (!product_slug) {
    return NextResponse.json({ success: false, error: "Invalid checkout request" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: productRow, error: productErr } = await supabase
    .from("products")
    .select("price_krw,title")
    .eq("slug", product_slug)
    .maybeSingle();

  if (productErr || !productRow) {
    return NextResponse.json({ success: false, error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }

  const amount_krw_list = Number(productRow.price_krw ?? 0);
  if (!Number.isFinite(amount_krw_list) || amount_krw_list <= 0) {
    return NextResponse.json({ success: false, error: "상품 가격이 올바르지 않습니다." }, { status: 400 });
  }

  let amount_krw = amount_krw_list;
  let couponApply: ReturnType<typeof resolveCheckoutCouponApply> | null = null;

  const serviceKey = env.supabaseServiceRoleKey;
  if (serviceKey) {
    const svc = createClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [discountCoupon, dreamPass] = await Promise.all([
      getActiveDiscountCoupon(svc, auth.userId),
      getActiveDreamPass(svc, auth.userId),
    ]);
    couponApply = resolveCheckoutCouponApply({
      product_slug,
      price_krw: amount_krw_list,
      discountCoupon,
      dreamPass,
    });
    amount_krw = couponApply.final_price_krw;
  }

  try {
    await spendCredits(auth.userId, amount_krw, {
      kind: "spend_fortune",
      ref_type: "product",
      ref_id: product_slug,
      memo: String(body.title ?? productRow.title ?? "").trim() || product_slug,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "spend_failed";
    if (msg === "insufficient_credits") {
      return NextResponse.json({ success: false, error: "insufficient_credits" }, { status: 402 });
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  if (couponApply && couponApply.discount_krw > 0 && serviceKey) {
    const svc = createClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await consumeCheckoutCoupons(svc, auth.userId, couponApply);
  }

  const order_no = generateOrderId();
  const paidAt = new Date().toISOString();
  const displayTitle = String(body.title ?? productRow.title ?? "").trim() || product_slug;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_no,
      user_ref: auth.userId,
      product_slug,
      status: "paid",
      amount_krw,
      currency: "KRW",
    })
    .select("id,order_no,status,amount_krw")
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ success: false, error: orderError?.message || "Order creation failed" }, { status: 500 });
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    order_id: order.id,
    provider: "yeonun-credit",
    method: "credit",
    status: "paid",
    paid_at: paidAt,
    raw_payload: {
      product_slug,
      title: displayTitle,
      source: "yeonun-fortune-credit",
      list_price_krw: amount_krw_list,
      coupon_discount_krw: couponApply?.discount_krw ?? 0,
      coupon_label: couponApply?.label ?? null,
      consume_discount_coupon_id: couponApply?.consume_discount_coupon_id ?? null,
      consume_dream_pass_id: couponApply?.consume_dream_pass_id ?? null,
    },
  });

  if (paymentError) {
    return NextResponse.json({ success: false, error: paymentError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    order,
    amount_krw,
    order_access_token: mintOrderAccessToken(order.order_no),
  });
}
