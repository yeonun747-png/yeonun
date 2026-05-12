import { timingSafeEqual } from "node:crypto";

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
