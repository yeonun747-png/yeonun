import { NextRequest, NextResponse } from "next/server";

import { getCharacterModePrompt, getCharacterPersona, getServicePrompt } from "@/lib/data/characters";
import { grantPurchaseCredits, isLoggedInUserId } from "@/lib/credit-server";
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

    if (order.status === "paid") {
      return NextResponse.json({ success: true, order, already_paid: true });
    }

    const paidAt = new Date().toISOString();
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .update({ status: "paid", paid_at: paidAt })
      .eq("order_id", order.id)
      .select("id,status,raw_payload")
      .maybeSingle();

    if (payErr) {
      return NextResponse.json({ success: false, error: payErr.message }, { status: 500 });
    }

    await supabase.from("orders").update({ status: "paid" }).eq("id", order.id);

    const product_slug = String(order.product_slug ?? "");
    const isCreditTopup = isCreditTopupProduct(product_slug);

    if (isCreditTopup && isLoggedInUserId(order.user_ref)) {
      const { data: existingGrant } = await supabase
        .from("user_credit_ledger")
        .select("id")
        .eq("user_id", order.user_ref)
        .eq("kind", "purchase")
        .eq("ref_id", String(order.id))
        .maybeSingle();

      if (!existingGrant) {
        const raw = (payment?.raw_payload ?? {}) as Record<string, unknown>;
        const grantBase = Number(raw.grant_base);
        const credits =
          Number.isFinite(grantBase) && grantBase > 0 ? Math.floor(grantBase) : Math.floor(order.amount_krw ?? 0);
        const firstBonus = Boolean(raw.first_voice_credit_bonus);
        await grantPurchaseCredits(order.user_ref, credits, {
          orderId: String(order.id),
          firstBonus,
        });
      }
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
          user_ref: order.user_ref ?? "guest",
          product_slug,
          order_id: order.id,
          status: "queued",
          model: "claude-4.6-sonnet",
          prompt_version_id: null,
          payload: {
            product_slug,
            order_no: order.order_no,
            payment_method: payment ? "pg" : "pg",
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
      payload: { order, payment, fortune_request: fortuneRequest },
      status: "processed",
      processed_at: paidAt,
    });

    return NextResponse.json({
      success: true,
      order: { ...order, status: "paid" },
      payment,
      fortune_request: fortuneRequest,
      is_credit_topup: isCreditTopup,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "결제 완료 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
