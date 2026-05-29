/** 음성 상담 종료 직후 — PWA 설치 유도 트리거 */
export const PWA_VOICE_CALL_ENDED_EVENT = "voiceCallEnded";

/** 점사 풀이 결과(Step7) 최초 진입 — PWA 설치 유도 트리거 */
export const PWA_FORTUNE_RESULT_ENTER_EVENT = "yeonun:fortune-result-enter";

export function dispatchVoiceCallEnded(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PWA_VOICE_CALL_ENDED_EVENT));
}

export function dispatchFortuneResultEnter(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PWA_FORTUNE_RESULT_ENTER_EVENT));
}
