import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  consumeCheckoutCoupons,
  getActiveDiscountCoupon,
  getActiveDreamPass,
  listUserCoupons,
  resolveCheckoutCouponApply,
} from "@/lib/mission-coupon-server";
import { env } from "@/lib/env";
import { requireMyUserId } from "@/lib/my-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  const serviceKey = env.supabaseServiceRoleKey;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  const supabase = createClient(env.supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const coupons = await listUserCoupons(supabase, auth.userId);
    return NextResponse.json({ ok: true, coupons });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** 결제 화면용 — 상품 slug 기준 자동 적용 쿠폰 견적 */
export async function POST(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { product_slug?: string; price_krw?: number };
  const product_slug = String(body.product_slug ?? "").trim();
  const price_krw = Math.max(0, Math.floor(Number(body.price_krw) || 0));
  if (!product_slug || price_krw <= 0) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const serviceKey = env.supabaseServiceRoleKey;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  const supabase = createClient(env.supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const [discountCoupon, dreamPass] = await Promise.all([
      getActiveDiscountCoupon(supabase, auth.userId),
      getActiveDreamPass(supabase, auth.userId),
    ]);
    const apply = resolveCheckoutCouponApply({ product_slug, price_krw, discountCoupon, dreamPass });
    return NextResponse.json({ ok: true, apply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "quote_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** 결제 완료 후 쿠폰 소진(크레딧 결제 등 클라이언트 완료 경로) */
export async function PUT(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { product_slug?: string; price_krw?: number };
  const product_slug = String(body.product_slug ?? "").trim();
  const price_krw = Math.max(0, Math.floor(Number(body.price_krw) || 0));

  const serviceKey = env.supabaseServiceRoleKey;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  const supabase = createClient(env.supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const [discountCoupon, dreamPass] = await Promise.all([
      getActiveDiscountCoupon(supabase, auth.userId),
      getActiveDreamPass(supabase, auth.userId),
    ]);
    const apply = resolveCheckoutCouponApply({ product_slug, price_krw, discountCoupon, dreamPass });
    if (apply.discount_krw > 0) {
      await consumeCheckoutCoupons(supabase, auth.userId, apply);
    }
    return NextResponse.json({ ok: true, apply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "consume_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
