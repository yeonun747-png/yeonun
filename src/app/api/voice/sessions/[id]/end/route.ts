import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    duration_sec?: number;
    cost_krw?: number;
    summary?: string;
  };

  const supabase = supabaseServer();
  const patch: Record<string, unknown> = {
    status: "ended",
    ended_at: new Date().toISOString(),
    duration_sec: Math.max(0, Math.round(Number(body.duration_sec ?? 0))),
    cost_krw: Math.max(0, Math.round(Number(body.cost_krw ?? 0))),
  };
  /** 요약 미전송 시 기존 summary(점사 맥락 등) 유지 — undefined/null만 오면 컬럼을 건드리지 않음 */
  if (typeof body.summary === "string") {
    patch.summary = body.summary;
  }

  const { data, error } = await supabase.from("voice_sessions").update(patch)
    .eq("id", id)
    .select("id,status,ended_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, session: data });
}

