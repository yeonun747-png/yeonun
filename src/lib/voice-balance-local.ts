/** 브라우저 로컬 음성 잔액(초) — 미션·출석·충전 등 합산 */

export const LS_VOICE_BALANCE_SEC = "yeonun_voice_balance_sec";

/** 무료 체험 전용 잔여(초). 미설정 시 기본 3분. 소진 로직은 통화 종료 시 차감 연동 예정 */
export const LS_VOICE_FREE_REMAINING_SEC = "yeonun_voice_free_remaining_sec";

export const DEFAULT_FREE_TRIAL_SEC = 180;

export function readVoiceBalanceSecClient(): number {
  if (typeof window === "undefined") return DEFAULT_FREE_TRIAL_SEC;
  try {
    const v = localStorage.getItem(LS_VOICE_BALANCE_SEC);
    if (v === null) return DEFAULT_FREE_TRIAL_SEC;
    return Math.max(0, parseInt(v, 10) || 0);
  } catch {
    return DEFAULT_FREE_TRIAL_SEC;
  }
}

/** 무료 체험 잔여 초 — 키 없으면 신규와 동일하게 3분으로 간주 */
export function readVoiceFreeRemainingSecClient(): number {
  if (typeof window === "undefined") return DEFAULT_FREE_TRIAL_SEC;
  try {
    const v = localStorage.getItem(LS_VOICE_FREE_REMAINING_SEC);
    if (v === null) return DEFAULT_FREE_TRIAL_SEC;
    return Math.max(0, parseInt(v, 10) || 0);
  } catch {
    return DEFAULT_FREE_TRIAL_SEC;
  }
}

export function voiceMinutesFloor(sec: number): number {
  return Math.floor(Math.max(0, sec) / 60);
}

/** 같은 탭에서 잔액 UI 새로고침용 (storage 이벤트는 다른 탭만 발동) */
export const YEONUN_VOICE_BALANCE_UPDATE_EVENT = "yeonun:voice-balance-update";

export function notifyVoiceBalanceUpdated(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(YEONUN_VOICE_BALANCE_UPDATE_EVENT));
  } catch {
    // ignore
  }
}

/** 결제 완료(목업 포함) 유료 음성 초 적립 — 미션·출석과 동일한 로컬 합산 규칙 */
export function applyPurchasedVoiceSeconds(sec: number): number {
  if (sec <= 0) return 0;
  if (typeof window === "undefined") return sec;
  try {
    const v = localStorage.getItem(LS_VOICE_BALANCE_SEC);
    const base = v === null ? DEFAULT_FREE_TRIAL_SEC : Math.max(0, parseInt(v, 10) || 0);
    localStorage.setItem(LS_VOICE_BALANCE_SEC, String(base + sec));
    notifyVoiceBalanceUpdated();
  } catch {
    // ignore
  }
  return sec;
}
