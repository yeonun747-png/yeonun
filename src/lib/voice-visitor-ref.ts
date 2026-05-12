const LS_KEY = "yeonun_voice_visitor_ref_v1";

/** 로그인 전에도 동일 단말에서 음성 인사이트·재방문 맥락을 이어가기 위한 익명 식별자 */
export function getOrCreateVoiceVisitorRef(): string {
  if (typeof window === "undefined") return "guest";
  try {
    let v = localStorage.getItem(LS_KEY);
    if (!v?.trim()) {
      v = `visitor_${crypto.randomUUID()}`;
      localStorage.setItem(LS_KEY, v);
    }
    return v.trim();
  } catch {
    return "guest";
  }
}
