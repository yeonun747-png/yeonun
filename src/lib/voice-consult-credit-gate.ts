import { CREDIT_VOICE_PER_SECOND } from "@/lib/credit-policy";
import { spendableTotalCredits } from "@/lib/credit-balance-local";

/** 음성 상담 시작에 필요한 최소 크레딧(1초 분당 과금 단위) */
export const CREDIT_VOICE_MIN_TO_START = Math.max(1, Math.ceil(CREDIT_VOICE_PER_SECOND));

export function hasVoiceConsultCredits(): boolean {
  return spendableTotalCredits() >= CREDIT_VOICE_MIN_TO_START;
}

export function voiceConsultCreditsShortfall(): number {
  return Math.max(0, CREDIT_VOICE_MIN_TO_START - spendableTotalCredits());
}
