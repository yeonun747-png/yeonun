import { applyBonusCredits } from "@/lib/credit-balance-local";
import { missionRewardCredits, type MissionId } from "@/lib/daily-missions";

/** 미션 완료 시 무료 크레딧 적립 */
export function applyMissionCreditReward(id: MissionId): number {
  const credits = missionRewardCredits(id);
  if (credits <= 0) return 0;
  applyBonusCredits(credits);
  return credits;
}

/** 출석 7일 보상 등 — 크레딧 수치(기존 필드명 voiceSecondsAdded와 호환 위해 숫자만 전달) */
export function applyAttendanceCreditReward(credits: number): number {
  if (credits <= 0) return 0;
  applyBonusCredits(credits);
  return credits;
}
