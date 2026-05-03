/**
 * 크레딧 상담 정책 (원화 1:1, 음성·채팅 소진 단위).
 * 서버·클라이언트 공통으로 import 가능한 상수만 둡니다.
 */

/** 1원 = 1크레딧 */
export const CREDIT_PER_KRW = 1;

/** 음성 상담: 분당 소진 크레딧 */
export const CREDIT_VOICE_PER_MINUTE = 390;
/** 음성 상담: 초당 소진 (390/60) */
export const CREDIT_VOICE_PER_SECOND = CREDIT_VOICE_PER_MINUTE / 60;

/** 채팅 상담: 사용자 메시지 1건당 */
export const CREDIT_CHAT_PER_USER_MESSAGE = 130;

/** 신규 가입 무료 크레딧 (음성 3분 상당) */
export const CREDIT_FREE_TRIAL_GRANT = 1170;

/** 무료 크레딧 만료(일) — 지급일 기준 */
export const CREDIT_FREE_TRIAL_VALID_DAYS = 30;

/** 충전 크레딧 유효(일) */
export const CREDIT_PAID_VALID_DAYS = 365;

export const CREDIT_PACKAGES = {
  basic: { priceKrw: 3900, grantCredits: 3900, bonusLabel: null as string | null },
  popular: { priceKrw: 9900, grantCredits: 11880, bonusLabel: "+20% (+1,980)" },
  premium: { priceKrw: 19900, grantCredits: 25870, bonusLabel: "+30% (+5,970)" },
} as const;

export function voiceMinutesFromCredits(credits: number): string {
  const m = credits / CREDIT_VOICE_PER_MINUTE;
  if (m >= 10) return `약 ${Math.floor(m)}분 음성`;
  if (m >= 1) return `약 ${m.toFixed(1)}분 음성`;
  return `약 ${Math.round(m * 60)}초 음성`;
}

export function chatMessagesFromCredits(credits: number): string {
  const n = Math.floor(credits / CREDIT_CHAT_PER_USER_MESSAGE);
  return `채팅 약 ${n}건(보내기 기준)`;
}

export function firstChargeTotalCredits(baseGrant: number): number {
  return Math.round(baseGrant * 1.1);
}
