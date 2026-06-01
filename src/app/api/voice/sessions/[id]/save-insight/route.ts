import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { requireVoiceSessionRollSecret } from "@/lib/voice-roll-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["event", "person", "emotion", "numeric", "relationship", "goal", "other"]);

type Body = {
  category?: string;
  detail?: string;
  importance_level?: number;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const sessionId = String(rawId ?? "").trim();
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;

  const supabase = supabaseServer();
  const access = await requireVoiceSessionRollSecret(supabase, sessionId, request, body);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  const category = String(body.category ?? "").trim().toLowerCase();
  const detail = String(body.detail ?? "").trim();
  let importance = Number(body.importance_level);

  if (!ALLOWED.has(category)) {
    return NextResponse.json({ ok: false, error: "invalid_category" }, { status: 400 });
  }
  if (!detail || detail.length > 2000) {
    return NextResponse.json({ ok: false, error: "invalid_detail" }, { status: 400 });
  }
  if (!Number.isFinite(importance)) importance = 3;
  importance = Math.min(5, Math.max(1, Math.round(importance)));

  const { data: sess, error: sessErr } = await supabase
    .from("voice_sessions")
    .select("id,character_key,user_ref,status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessErr || !sess) {
    return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
  }
  if (String(sess.status ?? "") !== "active") {
    return NextResponse.json({ ok: false, error: "session_not_active" }, { status: 409 });
  }

  const character_key = String(sess.character_key ?? "").trim();
  if (!character_key) {
    return NextResponse.json({ ok: false, error: "session_missing_character" }, { status: 409 });
  }

  const user_ref = String(sess.user_ref ?? "").trim() || "guest";

  const { data: row, error: insErr } = await supabase
    .from("voice_user_insights")
    .insert({
      user_ref,
      character_key,
      session_id: sessionId,
      category,
      detail: detail.slice(0, 2000),
      importance_level: importance,
    })
    .select("id")
    .maybeSingle();

  if (insErr) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", details: insErr.message.slice(0, 400) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true as const, id: row?.id ?? null });
}
