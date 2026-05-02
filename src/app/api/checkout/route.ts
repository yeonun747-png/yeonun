import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { getCharacterModePrompt, getCharacterPersona, getServicePrompt } from "@/lib/data/characters";

function orderNo() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  return `YN${ymd}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
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
  const character_key = typeof body.product_slug === "string" && ["zimi-chart", "newyear-2026", "tojeong-2026", "zimi-2026-flow"].includes(body.product_slug)
    ? "byeol"
    : typeof body.product_slug === "string" && ["lifetime-master", "saju-classic", "wealth-graph", "career-timing"].includes(body.product_slug)
      ? "yeo"
      : typeof body.product_slug === "string" && ["naming-baby", "taekil-goodday", "dream-lastnight"].includes(body.product_slug)
        ? "un"
        : "yeon";
  const [commonPrompt, characterPrompt, persona] = await Promise.all([
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

  if (paymentError) {
    return NextResponse.json({ error: paymentError.message }, { status: 500 });
  }

  const { data: fortuneRequest } = await supabase
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

