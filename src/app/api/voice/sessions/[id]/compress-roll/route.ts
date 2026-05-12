import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { runVoiceRollupHaiku } from "@/lib/voice-memory-haiku";
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

type Body = { force?: boolean };

function buildDialogExcerpt(
  turns: Array<{ role?: string; text?: string | null }>,
  charCap: number,
): string {
  const lines: string[] = [];
  let n = 0;
  for (const t of turns) {
    const role = String(t.role ?? "").trim();
    const text = String(t.text ?? "").trim().replace(/\s+/g, " ");
    if (!text) continue;
    const tag = role === "assistant" ? "상담자" : role === "user" ? "사용자" : role;
    const line = `${tag}: ${text}`;
    if (n + line.length > charCap) break;
    lines.push(line);
    n += line.length + 1;
  }
  return lines.join("\n");
}

function newVoiceRollSecret(): string {
  return randomBytes(24).toString("hex");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const oldId = String(rawId ?? "").trim();
  if (!oldId) return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const force = Boolean(body.force);
  const providedSecret = readVoiceRollSecret(request, body);
  if (!providedSecret) {
    return NextResponse.json({ ok: false, error: "roll_secret_required" }, { status: 401 });
  }

  const apiKey = String(process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY not configured" }, { status: 501 });
  }

  const supabase = supabaseServer();
  const { data: old, error: oErr } = await supabase
    .from("voice_sessions")
    .select(
      "id,status,started_at,user_ref,character_key,summary,memory_summary,continuity_summary,rolling_generation,roll_secret,realtime_total_tokens,realtime_max_response_latency_ms",
    )
    .eq("id", oldId)
    .maybeSingle();

  if (oErr || !old) return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
  if (!voiceRollSecretsMatch((old as { roll_secret?: string }).roll_secret, providedSecret)) {
    return NextResponse.json({ ok: false, error: "invalid_roll_secret" }, { status: 401 });
  }
  if (String(old.status ?? "") !== "active") {
    return NextResponse.json({ ok: false, error: "session_not_active" }, { status: 409 });
  }

  const character_key = String(old.character_key ?? "").trim();
  if (!character_key) {
    return NextResponse.json({ ok: false, error: "session_missing_character" }, { status: 409 });
  }

  const { data: turnRows, error: tErr } = await supabase
    .from("voice_turns")
    .select("role,text,created_at")
    .eq("session_id", oldId)
    .order("created_at", { ascending: true })
    .limit(120);

  if (tErr) {
    return NextResponse.json({ ok: false, error: "turns_fetch_failed", details: tErr.message }, { status: 500 });
  }

  const turns = Array.isArray(turnRows) ? turnRows : [];
  let transcriptChars = 0;
  let assistantTurns = 0;
  for (const t of turns) {
    const txt = String((t as { text?: string }).text ?? "");
    transcriptChars += txt.length;
    if (String((t as { role?: string }).role ?? "") === "assistant" && txt.trim()) assistantTurns += 1;
  }

  const started = new Date(String(old.started_at ?? "")).getTime();
  const elapsedMs = Number.isFinite(started) ? Math.max(0, Date.now() - started) : 0;

  const wall = rollWallMs();
  const maxResp = rollMaxAssistantResponses();
  const maxChars = rollMaxTranscriptChars();
  const tokCap = rollMaxRealtimeTotalTokens();
  const latCap = rollMaxResponseLatencyMs();
  const rtTok = Math.max(0, Number((old as { realtime_total_tokens?: number }).realtime_total_tokens ?? 0));
  const rtLat = Math.max(0, Number((old as { realtime_max_response_latency_ms?: number }).realtime_max_response_latency_ms ?? 0));

  const tokenRoll = rtTok >= tokCap;
  const latencyRoll = latCap != null && rtLat >= latCap;

  const shouldRoll =
    force ||
    elapsedMs >= wall ||
    assistantTurns >= maxResp ||
    transcriptChars >= maxChars ||
    tokenRoll ||
    latencyRoll;

  if (!shouldRoll) {
    return NextResponse.json({
      ok: false,
      error: "roll_conditions_not_met",
      hint: "Set force:true or wait for wall_time / response budget / transcript / realtime tokens / latency cap.",
      metrics: {
        elapsed_ms: elapsedMs,
        assistant_turns: assistantTurns,
        transcript_chars: transcriptChars,
        realtime_total_tokens: rtTok,
        realtime_max_response_latency_ms: rtLat,
      },
    });
  }

  const excerpt = buildDialogExcerpt(turns as Array<{ role?: string; text?: string | null }>, maxChars);
  if (excerpt.length < 80) {
    return NextResponse.json({ ok: false, error: "dialog_too_short_for_compression" }, { status: 400 });
  }

  const prior = [String(old.continuity_summary ?? "").trim(), String(old.memory_summary ?? "").trim()]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1500);

  let rollup: Awaited<ReturnType<typeof runVoiceRollupHaiku>>;
  try {
    rollup = await runVoiceRollupHaiku({
      apiKey,
      dialogExcerpt: excerpt,
      priorContinuity: prior || undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "haiku_failed", details: msg.slice(0, 400) }, { status: 502 });
  }

  let user_ref = String(old.user_ref ?? "").trim();
  if (!user_ref || user_ref === "guest") user_ref = `visitor_${randomBytes(16).toString("hex")}`;

  const nextGen = Math.max(0, Number(old.rolling_generation ?? 0)) + 1;
  const memorySummaryLines = rollup.compressed_bullets.length
    ? rollup.compressed_bullets.join("\n")
    : rollup.continuity_narrative.slice(0, 1200);

  const newRollSecret = newVoiceRollSecret();

  const { data: created, error: cErr } = await supabase
    .from("voice_sessions")
    .insert({
      character_key,
      user_ref,
      roll_secret: newRollSecret,
      status: "active",
      summary: old.summary ?? null,
      memory_summary: memorySummaryLines.slice(0, 8000),
      continuity_summary: rollup.continuity_narrative.slice(0, 4000),
      rolled_from_session_id: oldId,
      rolling_generation: nextGen,
    })
    .select("id,status,started_at,rolling_generation,roll_secret")
    .maybeSingle();

  if (cErr || !created?.id) {
    return NextResponse.json(
      { ok: false, error: "new_session_insert_failed", details: cErr?.message?.slice(0, 400) ?? "" },
      { status: 500 },
    );
  }

  const newId = String(created.id);

  const memRows = rollup.memories.map((m) => ({
    user_ref,
    character_key,
    session_id: newId,
    memory_type: m.type.slice(0, 64),
    importance: Math.round(m.importance * 1000) / 1000,
    summary: m.summary.slice(0, 600),
    promoted: m.importance >= 0.9,
  }));

  if (memRows.length) {
    const { error: mErr } = await supabase.from("voice_memory_entries").insert(memRows);
    if (mErr) {
      await supabase.from("voice_sessions").update({ status: "error" }).eq("id", newId);
      return NextResponse.json(
        { ok: false, error: "memory_insert_failed", details: mErr.message.slice(0, 400) },
        { status: 500 },
      );
    }
  }

  const duration_sec = Math.max(0, Math.round(elapsedMs / 1000));
  const { error: eErr } = await supabase
    .from("voice_sessions")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      duration_sec,
    })
    .eq("id", oldId);

  if (eErr) {
    return NextResponse.json(
      {
        ok: true,
        warning: "old_session_end_failed",
        new_session_id: newId,
        roll_secret: newRollSecret,
        details: eErr.message.slice(0, 400),
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    ok: true as const,
    new_session_id: newId,
    roll_secret: newRollSecret,
    rolling_generation: nextGen,
    memories_saved: memRows.length,
  });
}
