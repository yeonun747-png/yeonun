/** Realtime 롤링(새 세션 + 압축 메모리) 트리거 — 서버·클라이언트 공통 상수 */

export function rollWallMs(): number {
  const n = Number(String(process.env.VOICE_REALTIME_ROLL_WALL_MS ?? "").trim());
  if (Number.isFinite(n) && n >= 120_000 && n <= 1_800_000) return Math.floor(n);
  return 600_000;
}

export function rollMaxAssistantResponses(): number {
  const n = Number(String(process.env.VOICE_REALTIME_ROLL_MAX_RESPONSES ?? "").trim());
  if (Number.isFinite(n) && n >= 8 && n <= 200) return Math.floor(n);
  return 22;
}

export function rollMaxTranscriptChars(): number {
  const n = Number(String(process.env.VOICE_REALTIME_ROLL_MAX_TRANSCRIPT_CHARS ?? "").trim());
  if (Number.isFinite(n) && n >= 4000 && n <= 500_000) return Math.floor(n);
  return 14_000;
}

/** Realtime response.done 누적 total_tokens(클라이언트가 델타 보고) 기준 롤 상한 */
export function rollMaxRealtimeTotalTokens(): number {
  const n = Number(String(process.env.VOICE_REALTIME_ROLL_MAX_TOTAL_TOKENS ?? "").trim());
  if (Number.isFinite(n) && n >= 8_000 && n <= 2_000_000) return Math.floor(n);
  return 220_000;
}

/**
 * 단일 응답 생성 지연(response.created→response.done) 상한(ms). 초과 시 롤 후보.
 * VOICE_REALTIME_ROLL_MAX_RESPONSE_LATENCY_MS=0 이면 비활성.
 */
export function rollMaxResponseLatencyMs(): number | null {
  const n = Number(String(process.env.VOICE_REALTIME_ROLL_MAX_RESPONSE_LATENCY_MS ?? "").trim());
  if (!Number.isFinite(n) || n < 0) return 18_000;
  if (n === 0) return null;
  if (n >= 2_000 && n <= 120_000) return Math.floor(n);
  return 18_000;
}
