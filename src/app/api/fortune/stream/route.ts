import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { getCharacterModePrompt, getCharacterPersona, getServicePrompt } from "@/lib/data/characters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function createFortuneRequest(payload: Record<string, unknown>) {
  const supabase = supabaseServer();
  const characterKey = typeof payload.character_key === "string" ? payload.character_key : "yeon";
  const userRef = typeof payload.user_ref === "string" ? payload.user_ref : null;
  const [commonPrompt, characterPrompt, persona] = await Promise.all([
    getServicePrompt("yeonun_fortune_text_system"),
    getCharacterModePrompt(characterKey, "fortune_text"),
    getCharacterPersona(characterKey),
  ]);

  let recentSummary = "";
  if (userRef) {
    const { data: priorRequests } = await supabase
      .from("fortune_requests")
      .select("id,payload,created_at")
      .eq("user_ref", userRef)
      .order("created_at", { ascending: false })
      .limit(12);
    const filtered = (priorRequests ?? []).filter((r: any) => {
      const p = r?.payload && typeof r.payload === "object" ? r.payload : {};
      return String((p as any).character_key ?? "") === characterKey;
    });
    const ids = filtered.map((r: any) => String(r.id)).filter(Boolean).slice(0, 6);
    if (ids.length > 0) {
      const { data: priorResults } = await supabase
        .from("fortune_results")
        .select("request_id,summary,completed_at")
        .in("request_id", ids)
        .order("completed_at", { ascending: false });
      recentSummary = (priorResults ?? [])
        .map((r: any) => String(r?.summary ?? "").trim())
        .filter(Boolean)
        .slice(0, 5)
        .map((s: string, i: number) => `${i + 1}. ${s.length > 800 ? `${s.slice(0, 800)}…` : s}`)
        .join("\n");
    }
  }

  const manseContext = String(
    payload.manse_context ??
      payload.manseContext ??
      payload.saju_context ??
      payload.sajuContext ??
      payload.manse_text ??
      payload.manseText ??
      "",
  ).trim();
  const finalSystemPrompt = [
    String(commonPrompt?.prompt ?? "").trim(),
    String(characterPrompt?.prompt ?? "").trim(),
    manseContext ? `[사용자 사주 명식 데이터]\n${manseContext.slice(0, 5000)}` : "",
    recentSummary ? `[최근 상담 히스토리 요약]\n${recentSummary.slice(0, 3000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const enrichedPayload = {
    ...payload,
    character_key: characterKey,
    common_system_prompt: commonPrompt?.prompt ?? null,
    character_system_prompt: characterPrompt?.prompt ?? null,
    final_system_prompt: finalSystemPrompt,
    recent_history_summary: recentSummary || null,
    persona_snapshot: persona ?? null,
  };
  const row = {
    user_ref: userRef,
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

