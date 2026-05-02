import { missionVoiceRewardSec, type MissionId } from "@/lib/daily-missions";
import { LS_VOICE_BALANCE_SEC } from "@/lib/voice-balance-local";

/** 로컬 음성 잔여(초)에 미션 보상 반영 */
export function applyVoiceMissionRewardSeconds(id: MissionId): number {
  const sec = missionVoiceRewardSec(id);
  if (sec <= 0) return 0;
  if (typeof window === "undefined") return sec;
  try {
    const v = localStorage.getItem(LS_VOICE_BALANCE_SEC);
    const base = v === null ? 180 : Math.max(0, parseInt(v, 10) || 0);
    const next = base + sec;
    localStorage.setItem(LS_VOICE_BALANCE_SEC, String(next));
  } catch {
    // ignore
  }
  return sec;
}

/** 매일 출석 7일 보상 등 임의 초 단위 음성 크레딧 적립 */
export function applyAttendanceVoiceRewardSeconds(sec: number): number {
  if (sec <= 0) return 0;
  if (typeof window === "undefined") return sec;
  try {
    const v = localStorage.getItem(LS_VOICE_BALANCE_SEC);
    const base = v === null ? 180 : Math.max(0, parseInt(v, 10) || 0);
    localStorage.setItem(LS_VOICE_BALANCE_SEC, String(base + sec));
  } catch {
    // ignore
  }
  return sec;
}
