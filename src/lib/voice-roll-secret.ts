import { timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

/** compress-roll / roll-status / realtime-usage 공통 */
export const VOICE_ROLL_SECRET_HEADER = "x-voice-roll-secret";

export function readVoiceRollSecret(request: Request, body?: unknown): string {
  const h = request.headers.get(VOICE_ROLL_SECRET_HEADER)?.trim();
  if (h) return h;
  if (body && typeof body === "object" && body !== null) {
    const rs = (body as Record<string, unknown>).roll_secret;
    if (typeof rs === "string") return rs.trim();
  }
  return "";
}

export function voiceRollSecretsMatch(stored: string | null | undefined, provided: string): boolean {
  const a = String(stored ?? "").trim();
  const b = String(provided ?? "").trim();
  if (!a || !b) return false;
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

type VoiceSessionRow = { id: string; roll_secret?: string | null; status?: string | null };

/** voice_sessions mutating/read 민감 API 공통 */
export async function requireVoiceSessionRollSecret(
  supabase: SupabaseClient,
  sessionId: string,
  request: Request,
  body?: unknown,
): Promise<
  | { ok: true; session: VoiceSessionRow }
  | { ok: false; status: number; error: string }
> {
  const sid = String(sessionId ?? "").trim();
  if (!sid) return { ok: false, status: 400, error: "invalid_session" };

  const providedSecret = readVoiceRollSecret(request, body);
  if (!providedSecret) return { ok: false, status: 401, error: "roll_secret_required" };

  const { data: sess, error } = await supabase
    .from("voice_sessions")
    .select("id,roll_secret,status")
    .eq("id", sid)
    .maybeSingle();

  if (error || !sess) return { ok: false, status: 404, error: "session_not_found" };
  if (!voiceRollSecretsMatch((sess as VoiceSessionRow).roll_secret, providedSecret)) {
    return { ok: false, status: 401, error: "invalid_roll_secret" };
  }
  return { ok: true, session: sess as VoiceSessionRow };
}
