import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { readVoiceRollSecret, voiceRollSecretsMatch } from "@/lib/voice-roll-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  input_tokens_delta?: number;
  output_tokens_delta?: number;
  total_tokens_delta?: number;
  response_latency_ms?: number;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const sessionId = String(rawId ?? "").trim();
  if (!sessionId) return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const secret = readVoiceRollSecret(request, body);
  if (!secret) {
    return NextResponse.json({ ok: false, error: "roll_secret_required" }, { status: 401 });
  }

  const di = Math.max(0, Math.floor(Number(body.input_tokens_delta ?? 0) || 0));
  const do_ = Math.max(0, Math.floor(Number(body.output_tokens_delta ?? 0) || 0));
  const dt = Math.max(0, Math.floor(Number(body.total_tokens_delta ?? 0) || 0));
  const lat = Math.max(0, Math.floor(Number(body.response_latency_ms ?? 0) || 0));

  if (di === 0 && do_ === 0 && dt === 0 && lat === 0) {
    return NextResponse.json({ ok: false, error: "no_metrics" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: row, error: qErr } = await supabase
    .from("voice_sessions")
    .select("id,status,roll_secret,realtime_input_tokens,realtime_output_tokens,realtime_total_tokens,realtime_max_response_latency_ms")
    .eq("id", sessionId)
    .maybeSingle();

  if (qErr || !row) return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
  if (!voiceRollSecretsMatch((row as { roll_secret?: string }).roll_secret, secret)) {
    return NextResponse.json({ ok: false, error: "invalid_roll_secret" }, { status: 401 });
  }
  if (String((row as { status?: string }).status ?? "") !== "active") {
    return NextResponse.json({ ok: false, error: "session_not_active" }, { status: 409 });
  }

  const curIn = Math.max(0, Number((row as { realtime_input_tokens?: number }).realtime_input_tokens ?? 0));
  const curOut = Math.max(0, Number((row as { realtime_output_tokens?: number }).realtime_output_tokens ?? 0));
  const curTot = Math.max(0, Number((row as { realtime_total_tokens?: number }).realtime_total_tokens ?? 0));
  const curLat = Math.max(0, Number((row as { realtime_max_response_latency_ms?: number }).realtime_max_response_latency_ms ?? 0));

  const nextIn = curIn + di;
  const nextOut = curOut + do_;
  const nextTot = curTot + dt;
  const nextLat = lat > 0 ? Math.max(curLat, lat) : curLat;

  const { error: uErr } = await supabase
    .from("voice_sessions")
    .update({
      realtime_input_tokens: nextIn,
      realtime_output_tokens: nextOut,
      realtime_total_tokens: nextTot,
      realtime_max_response_latency_ms: nextLat,
    })
    .eq("id", sessionId);

  if (uErr) {
    return NextResponse.json({ ok: false, error: "update_failed", details: uErr.message.slice(0, 200) }, { status: 500 });
  }

  return NextResponse.json({
    ok: true as const,
    totals: {
      realtime_input_tokens: nextIn,
      realtime_output_tokens: nextOut,
      realtime_total_tokens: nextTot,
      realtime_max_response_latency_ms: nextLat,
    },
  });
}
