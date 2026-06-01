import { NextResponse } from "next/server";

import {
  buildVoiceTurnsDialogExcerpt,
  fallbackVoiceArchiveSubtitle,
  summarizeVoiceArchiveSubtitleHaiku,
  VOICE_ARCHIVE_SUBTITLE_MAX_CHARS,
} from "@/lib/voice-archive-subtitle-haiku";
import { supabaseServer } from "@/lib/supabase/server";
import { requireVoiceSessionRollSecret } from "@/lib/voice-roll-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const sid = String(sessionId ?? "").trim();
  if (!sid) {
    return NextResponse.json({ ok: false, error: "missing_session" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const access = await requireVoiceSessionRollSecret(supabase, sid, request);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  const { data: sess, error: sErr } = await supabase
    .from("voice_sessions")
    .select("id, status, archive_subtitle")
    .eq("id", sid)
    .maybeSingle();

  if (sErr || !sess) {
    return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
  }

  const existing = String((sess as { archive_subtitle?: string }).archive_subtitle ?? "").trim();
  if (existing) {
    return NextResponse.json({ ok: true as const, subtitle: existing, skipped: "already_set" });
  }

  /** 종료 직후 마지막 전사 flush 대기 */
  await new Promise((r) => setTimeout(r, 600));

  const { data: turns, error: tErr } = await supabase
    .from("voice_turns")
    .select("role, text, created_at")
    .eq("session_id", sid)
    .order("created_at", { ascending: true });

  if (tErr) {
    return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
  }

  const excerpt = buildVoiceTurnsDialogExcerpt(
    (turns ?? []).map((t) => ({
      role: String((t as { role?: string }).role ?? ""),
      text: String((t as { text?: string }).text ?? ""),
    })),
  );

  let subtitle = "";
  const apiKey = String(process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY ?? "").trim();
  if (excerpt.length >= 12 && apiKey) {
    try {
      subtitle = await summarizeVoiceArchiveSubtitleHaiku(excerpt, apiKey);
    } catch {
      subtitle = "";
    }
  }
  if (!subtitle) {
    subtitle = fallbackVoiceArchiveSubtitle(excerpt);
  }

  if (!subtitle) {
    return NextResponse.json({ ok: true as const, subtitle: null, skipped: "no_content" });
  }

  subtitle = subtitle.trim().slice(0, VOICE_ARCHIVE_SUBTITLE_MAX_CHARS);

  const { error: uErr } = await supabase
    .from("voice_sessions")
    .update({ archive_subtitle: subtitle })
    .eq("id", sid);

  if (uErr) {
    return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, subtitle });
}
