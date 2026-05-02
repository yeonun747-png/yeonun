import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * 점사 모달 완료 시 보관함(DB) 저장 — fortune_requests + fortune_results.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    product_slug?: string;
    order_no?: string | null;
    character_key?: string;
    profile?: string;
    title?: string;
    html?: string;
    summary?: string | null;
    /** 점사 SSE 목차 스냅샷 — 보관함 재생 시 모달과 동일 TOC UI */
    toc_sections?: unknown;
    toc_groups?: unknown;
  };

  const product_slug = String(body.product_slug ?? "").trim();
  const html = typeof body.html === "string" ? body.html : "";
  if (!product_slug || !html.trim()) {
    return NextResponse.json({ error: "product_slug and html are required" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = supabaseServer();
  } catch {
    return NextResponse.json({ error: "server_storage_unconfigured", saved: false }, { status: 503 });
  }

  const order_no = body.order_no != null ? String(body.order_no).trim() : "";
  let order_id: string | null = null;
  if (order_no) {
    const { data: ord } = await supabase.from("orders").select("id").eq("order_no", order_no).maybeSingle();
    order_id = ord?.id ?? null;
  }

  const payload = {
    title: String(body.title ?? "").trim() || null,
    character_key: String(body.character_key ?? "").trim() || null,
    profile: body.profile === "pair" ? "pair" : "single",
    source: "fortune_stream_modal",
    ...(Array.isArray(body.toc_sections) ? { toc_sections: body.toc_sections } : {}),
    ...(Array.isArray(body.toc_groups) ? { toc_groups: body.toc_groups } : {}),
  };

  const { data: reqRow, error: reqErr } = await supabase
    .from("fortune_requests")
    .insert({
      user_ref: "guest",
      product_slug,
      order_id,
      status: "completed",
      model: String(process.env.FORTUNE_CLOUDWAYS_MODEL ?? "claude-sonnet-4-6"),
      prompt_version_id: null,
      payload,
    })
    .select("id")
    .maybeSingle();

  if (reqErr || !reqRow?.id) {
    return NextResponse.json({ error: reqErr?.message ?? "insert fortune_requests failed", saved: false }, { status: 500 });
  }

  const { data: resRow, error: resErr } = await supabase
    .from("fortune_results")
    .insert({
      request_id: reqRow.id,
      status: "completed",
      html,
      summary: body.summary != null ? String(body.summary) : null,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (resErr || !resRow?.id) {
    return NextResponse.json({ error: resErr?.message ?? "insert fortune_results failed", saved: false }, { status: 500 });
  }

  return NextResponse.json({ success: true, saved: true, request_id: reqRow.id, result_id: resRow.id });
}
