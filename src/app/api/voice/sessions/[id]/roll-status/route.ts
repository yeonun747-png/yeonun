import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { readVoiceRollSecret, voiceRollSecretsMatch } from "@/lib/voice-roll-secret";
import {
  rollMaxAssistantResponses,
  rollMaxRealtimeTotalTokens,
  rollMaxResponseLatencyMs,
  rollMaxTranscriptChars,
  rollWallMs,
} from "@/lib/voice-roll-triggers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const sid = String(sessionId ?? "").trim();
  if (!sid) return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 400 });

  const providedSecret = readVoiceRollSecret(request, undefined);
  if (!providedSecret) {
    return NextResponse.json({ ok: false, error: "roll_secret_required" }, { status: 401 });
  }

  const supabase = supabaseServer();
  const { data: sess, error: sErr } = await supabase
    .from("voice_sessions")
    .select(
      "id,status,started_at,character_key,user_ref,roll_secret,realtime_total_tokens,realtime_max_response_latency_ms",
    )
    .eq("id", sid)
    .maybeSingle();

  if (sErr || !sess) return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
  if (!voiceRollSecretsMatch((sess as { roll_secret?: string }).roll_secret, providedSecret)) {
    return NextResponse.json({ ok: false, error: "invalid_roll_secret" }, { status: 401 });
  }
  if (String(sess.status ?? "") !== "active") {
    return NextResponse.json({
      ok: true,
      active: false,
      should_roll: false,
      reasons: ["session_not_active"],
    });
  }

  const { data: rows, error: tErr } = await supabase
    .from("voice_turns")
    .select("role,text,created_at")
    .eq("session_id", sid)
    .order("created_at", { ascending: true })
    .limit(200);

  const turns = Array.isArray(rows) ? rows : [];
  let transcriptChars = 0;
  let assistantTurns = 0;
  for (const t of turns) {
    const txt = String((t as { text?: string }).text ?? "");
    transcriptChars += txt.length;
    if (String((t as { role?: string }).role ?? "") === "assistant" && txt.trim()) assistantTurns += 1;
  }

  const started = new Date(String(sess.started_at ?? "")).getTime();
  const elapsedMs = Number.isFinite(started) ? Math.max(0, Date.now() - started) : 0;

  const reasons: string[] = [];
  const wall = rollWallMs();
  const maxResp = rollMaxAssistantResponses();
  const maxChars = rollMaxTranscriptChars();
  const tokCap = rollMaxRealtimeTotalTokens();
  const latCap = rollMaxResponseLatencyMs();
  const rtTok = Math.max(0, Number((sess as { realtime_total_tokens?: number }).realtime_total_tokens ?? 0));
  const rtLat = Math.max(0, Number((sess as { realtime_max_response_latency_ms?: number }).realtime_max_response_latency_ms ?? 0));

  if (elapsedMs >= wall) reasons.push("wall_time");
  if (assistantTurns >= maxResp) reasons.push("assistant_response_budget");
  if (transcriptChars >= maxChars) reasons.push("transcript_size");
  if (rtTok >= tokCap) reasons.push("realtime_total_tokens");
  if (latCap != null && rtLat >= latCap) reasons.push("realtime_response_latency");

  const should_roll = reasons.length > 0;

  return NextResponse.json({
    ok: true,
    active: true,
    should_roll,
    reasons,
    metrics: {
      elapsed_ms: elapsedMs,
      wall_ms: wall,
      assistant_turns: assistantTurns,
      assistant_turn_cap: maxResp,
      transcript_chars: transcriptChars,
      transcript_char_cap: maxChars,
      realtime_total_tokens: rtTok,
      realtime_total_token_cap: tokCap,
      realtime_max_response_latency_ms: rtLat,
      realtime_response_latency_cap_ms: latCap,
    },
  });
}
