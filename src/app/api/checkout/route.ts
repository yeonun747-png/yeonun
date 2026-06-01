import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { ageGateToNextResponse, assertUserAge14Plus } from "@/lib/age-policy";
import { isLoggedInUserId } from "@/lib/credit-server";
import { resolveCreditGrantBase } from "@/lib/credit-grant-resolve";
import { mintOrderAccessToken } from "@/lib/order-access";
import {
  consumeCheckoutCoupons,
  getActiveDiscountCoupon,
  getActiveDreamPass,
  resolveCheckoutCouponApply,
} from "@/lib/mission-coupon-server";
import { env } from "@/lib/env";
import { formatPaymentCode, generateOrderId } from "@/lib/payment-utils";
import { supabaseServer } from "@/lib/supabase/server";

const CREDIT_TOPUP_PRODUCT_PRESETS: Record<
  string,
  { title: string; quote: string; badge: string | null; price_krw: number; tags: string[] }
> = {
  "credit-package-basic": {
    title: "크레딧 기본 충전",
    quote: "음성·채팅 상담에 쓰이는 크레딧을 충전합니다.",
    badge: null,
    price_krw: 3900,
    tags: ["#크레딧", "#충전"],
  },
  "credit-package-popular": {
    title: "크레딧 인기 패키지",
    quote: "+20% 보너스 크레딧이 포함된 패키지입니다.",
    badge: "BEST",
    price_krw: 9900,
    tags: ["#크레딧", "#충전", "#보너스"],
  },
  "credit-package-premium": {
    title: "크레딧 프리미엄 패키지",
    quote: "+30% 보너스 크레딧이 포함된 패키지입니다.",
    badge: null,
    price_krw: 19900,
    tags: ["#크레딧", "#충전", "#보너스"],
  },
};

function isCreditTopupProduct(product_slug: string) {
  return product_slug.startsWith("credit-package") || product_slug.includes("voice-credit") || product_slug.startsWith("credit");
}

async function ensureCreditTopupProductExists(
  supabase: ReturnType<typeof supabaseServer>,
  product_slug: string,
  title: string | undefined,
  amount_krw: number,
) {
  await supabase.from("categories").upsert({ slug: "all", label: "전체", sort_order: 0 }, { onConflict: "slug" });

  const preset = CREDIT_TOPUP_PRODUCT_PRESETS[product_slug];
  const fallbackTitle = String(title ?? "").trim() || "크레딧 충전";
  await supabase.from("products").upsert(
    {
      slug: product_slug,
      title: preset?.title ?? fallbackTitle,
      quote: preset?.quote ?? "음성·채팅 상담에 쓰이는 크레딧을 충전합니다.",
      category_slug: "all",
      badge: preset?.badge ?? null,
      price_krw: preset?.price_krw ?? amount_krw,
      character_key: "yeon",
      home_section_slug: null,
      tags: preset?.tags ?? ["#크레딧", "#충전"],
      saju_input_profile: "single",
    },
    { onConflict: "slug" },
  );
}

async function resolveCheckoutUserRef(request: Request): Promise<string> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (token) {
    const supabase = supabaseServer();
    const { data } = await supabase.auth.getUser(token);
    if (data?.user?.id && isLoggedInUserId(data.user.id)) {
      return data.user.id;
    }
  }
  return "guest";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    product_slug?: string;
    title?: string;
    price_krw?: number;
    method?: string;
    first_voice_credit_bonus?: boolean;
    voice_package_minutes?: number | null;
    grant_base?: number;
  };

  const product_slug = String(body.product_slug ?? "").trim();
  const clientAmount = Number(body.price_krw ?? 0);
  const method = String(body.method ?? "card").trim() || "card";
  const usePg = method === "card" || method === "phone";

  if (!usePg) {
    return NextResponse.json({ error: "unsupported_payment_method" }, { status: 400 });
  }

  if (!product_slug) {
    return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const isCreditTopup = isCreditTopupProduct(product_slug);
  if (isCreditTopup) {
    await ensureCreditTopupProductExists(supabase, product_slug, body.title, clientAmount);
  }

  const user_ref = await resolveCheckoutUserRef(request);
  if (isLoggedInUserId(user_ref)) {
    const gate = await assertUserAge14Plus(user_ref);
    const denied = ageGateToNextResponse(gate);
    if (denied) return denied;
  }
  if (isCreditTopup && !isLoggedInUserId(user_ref)) {
    return NextResponse.json({ error: "login_required", message: "크레딧 충전은 로그인 후 이용할 수 있습니다." }, { status: 401 });
  }

  const order_no = generateOrderId();

  const { data: productRow, error: productErr } = await supabase
    .from("products")
    .select("payment_code,price_krw,title")
    .eq("slug", product_slug)
    .maybeSingle();

  if (productErr || !productRow) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }

  const payment_code = productRow.payment_code;
  const codeStr = formatPaymentCode(payment_code);
  if (!codeStr) {
    return NextResponse.json({ error: "상품 결제 코드가 없습니다. 관리자에게 문의해 주세요." }, { status: 400 });
  }

  const amount_krw_list = Number(productRow.price_krw ?? 0);
  if (!Number.isFinite(amount_krw_list) || amount_krw_list <= 0) {
    return NextResponse.json({ error: "상품 가격이 올바르지 않습니다." }, { status: 400 });
  }

  let amount_krw = amount_krw_list;
  let couponApply: ReturnType<typeof resolveCheckoutCouponApply> | null = null;

  if (isLoggedInUserId(user_ref) && !isCreditTopup) {
    const serviceKey = env.supabaseServiceRoleKey;
    if (serviceKey) {
      const svc = createClient(env.supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const [discountCoupon, dreamPass] = await Promise.all([
        getActiveDiscountCoupon(svc, user_ref),
        getActiveDreamPass(svc, user_ref),
      ]);
      couponApply = resolveCheckoutCouponApply({
        product_slug,
        price_krw: amount_krw_list,
        discountCoupon,
        dreamPass,
      });
      amount_krw = couponApply.final_price_krw;
    }
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_no,
      user_ref,
      product_slug,
      status: "pending",
      amount_krw,
      currency: "KRW",
    })
    .select("id,order_no,status,amount_krw")
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message || "Order creation failed" }, { status: 500 });
  }

  const serverGrantBase = isCreditTopup ? resolveCreditGrantBase(product_slug, amount_krw) : null;

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      order_id: order.id,
      provider: "fortune82-pg",
      method,
      status: "pending",
      raw_payload: {
        product_slug,
        payment_code: codeStr,
        title: body.title ?? productRow.title ?? null,
        source: "yeonun-payment-modal",
        voice_package_minutes:
          typeof body.voice_package_minutes === "number" && Number.isFinite(body.voice_package_minutes)
            ? body.voice_package_minutes
            : null,
        grant_base: serverGrantBase,
        list_price_krw: amount_krw_list,
        coupon_discount_krw: couponApply?.discount_krw ?? 0,
        coupon_label: couponApply?.label ?? null,
        consume_discount_coupon_id: couponApply?.consume_discount_coupon_id ?? null,
        consume_dream_pass_id: couponApply?.consume_dream_pass_id ?? null,
      },
    })
    .select("id,status")
    .maybeSingle();

  if (paymentError || !payment) {
    return NextResponse.json({ error: paymentError?.message || "Payment creation failed" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    pg_flow: true,
    order,
    payment,
    payment_code: codeStr,
    amount_krw,
    order_access_token: mintOrderAccessToken(order.order_no),
  });
}

