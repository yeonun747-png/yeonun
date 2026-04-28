import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { getCharacterModePrompt, getCharacterPersona, getServicePrompt } from "@/lib/data/characters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function createFortuneRequest(payload: Record<string, unknown>) {
  const supabase = supabaseServer();
  const characterKey = typeof payload.character_key === "string" ? payload.character_key : "yeon";
  const [commonPrompt, characterPrompt, persona] = await Promise.all([
    getServicePrompt("yeonun_fortune_text_system"),
    getCharacterModePrompt(characterKey, "fortune_text"),
    getCharacterPersona(characterKey),
  ]);
  const enrichedPayload = {
    ...payload,
    character_key: characterKey,
    common_system_prompt: commonPrompt?.prompt ?? null,
    character_system_prompt: characterPrompt?.prompt ?? null,
    persona_snapshot: persona ?? null,
  };
  const row = {
    user_ref: typeof payload.user_ref === "string" ? payload.user_ref : null,
    product_slug: typeof payload.product_slug === "string" ? payload.product_slug : null,
    order_id: typeof payload.order_id === "string" ? payload.order_id : null,
    status: "streaming",
    model: "claude-4.6-sonnet",
    prompt_version_id: typeof payload.prompt_version_id === "string" ? payload.prompt_version_id : null,
    payload: enrichedPayload,
  };

  const { data } = await supabase.from("fortune_requests").insert(row).select("id").maybeSingle();
  return { id: data?.id as string | undefined, payload: enrichedPayload };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const cloudwaysUrl = String(process.env.CLOUDWAYS_FORTUNE_URL || process.env.CLOUDWAYS_URL || "").replace(/\/$/, "");
  const cloudwaysSecret = String(process.env.CLOUDWAYS_PROXY_SECRET || "");

  if (!cloudwaysUrl) {
    return NextResponse.json(
      { error: "CLOUDWAYS_FORTUNE_URL is not configured", hint: "Cloudways Claude streaming proxy is required." },
      { status: 501 },
    );
  }

  let requestId: string | undefined;
  let upstreamPayload = body;
  try {
    const created = await createFortuneRequest(body);
    requestId = created.id;
    upstreamPayload = created.payload;
  } catch {
    // fortune_requests 테이블이 아직 없을 수 있으므로 스트림 자체는 계속 시도한다.
  }

  const upstream = await fetch(`${cloudwaysUrl}/fortune/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(cloudwaysSecret ? { Authorization: `Bearer ${cloudwaysSecret}` } : {}),
    },
    cache: "no-store",
    body: JSON.stringify({
      ...upstreamPayload,
      request_id: requestId,
      model: "claude-4.6-sonnet",
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const message = await upstream.text().catch(() => "");
    return NextResponse.json({ error: "Cloudways fortune stream failed", details: message }, { status: upstream.status || 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...(requestId ? { "X-Yeonun-Fortune-Request-Id": requestId } : {}),
    },
  });
}

