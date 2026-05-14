import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { getCharacterModePrompt, getCharacterPersona, getServicePrompt } from "@/lib/data/characters";

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

function orderNo() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  return `YN${ymd}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    product_slug?: string;
    title?: string;
    price_krw?: number;
    method?: string;
    user_ref?: string;
    first_voice_credit_bonus?: boolean;
    voice_package_minutes?: number | null;
  };

  const product_slug = String(body.product_slug ?? "").trim();
  const amount_krw = Number(body.price_krw ?? 0);
  const method = String(body.method ?? "card").trim() || "card";

  if (!product_slug || !Number.isFinite(amount_krw) || amount_krw < 0) {
    return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const order_no = orderNo();
  const isCreditTopup = isCreditTopupProduct(product_slug);
  if (isCreditTopup) {
    await ensureCreditTopupProductExists(supabase, product_slug, body.title, amount_krw);
  }
  const character_key = typeof body.product_slug === "string" && ["zimi-chart", "newyear-2026", "tojeong-2026", "zimi-2026-flow"].includes(body.product_slug)
    ? "byeol"
    : typeof body.product_slug === "string" && ["lifetime-master", "saju-classic", "wealth-graph", "career-timing"].includes(body.product_slug)
      ? "yeo"
      : typeof body.product_slug === "string" && ["naming-baby", "taekil-goodday", "dream-lastnight"].includes(body.product_slug)
        ? "un"
        : "yeon";
  const [commonPrompt, characterPrompt, persona] = isCreditTopup
    ? [null, null, null]
    : await Promise.all([
        getServicePrompt("yeonun_fortune_text_system"),
        getCharacterModePrompt(character_key, "fortune_text"),
        getCharacterPersona(character_key),
      ]);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_no,
      user_ref: body.user_ref ?? "guest",
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

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      order_id: order.id,
      provider: "manual-dev",
      method,
      status: "pending",
      raw_payload: {
        product_slug,
        title: body.title ?? null,
        source: "yeonun-payment-modal",
        first_voice_credit_bonus: Boolean(body.first_voice_credit_bonus),
        voice_package_minutes:
          typeof body.voice_package_minutes === "number" && Number.isFinite(body.voice_package_minutes)
            ? body.voice_package_minutes
            : null,
      },
    })
    .select("id,status")
    .maybeSingle();

  if (paymentError || !payment) {
    return NextResponse.json({ error: paymentError?.message || "Payment creation failed" }, { status: 500 });
  }

  const paidAt = new Date().toISOString();
  await supabase.from("payments").update({ status: "paid", paid_at: paidAt }).eq("id", payment.id);
  await supabase.from("orders").update({ status: "paid" }).eq("id", order.id);

  const { data: fortuneRequest } = isCreditTopup
    ? { data: null }
    : await supabase
        .from("fortune_requests")
        .insert({
          user_ref: body.user_ref ?? "guest",
          product_slug,
          order_id: order.id,
          status: "queued",
          model: "claude-4.6-sonnet",
          prompt_version_id: null,
          payload: {
            product_slug,
            title: body.title ?? null,
            order_no,
            payment_method: method,
            character_key,
            common_system_prompt: commonPrompt?.prompt ?? null,
            character_system_prompt: characterPrompt?.prompt ?? null,
            persona_snapshot: persona ?? null,
          },
        })
        .select("id,status")
        .maybeSingle();

  await supabase.from("webhook_events").insert({
    provider: "manual-dev",
    event_type: "checkout.created",
    event_id: order_no,
    payload: { order, payment, fortune_request: fortuneRequest },
    status: "processed",
    processed_at: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    order,
    payment,
    fortune_request: fortuneRequest,
  });
}

