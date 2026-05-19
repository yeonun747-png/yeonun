import { applyBonusCredits } from "@/lib/credit-balance-local";
import { syncCreditsFromServer } from "@/lib/credit-client";
import { dispatchMissionToast, MISSIONS, missionCompleteToastMessage, missionRewardCredits, type MissionId } from "@/lib/daily-missions";
import { supabaseBrowser } from "@/lib/supabase/client";

export type MissionRewardResult = {
  credits: number;
  couponGranted: boolean;
  couponPending: boolean;
  serverSynced: boolean;
};

function buildGrantKey(id: MissionId, nowMs: number): string {
  const def = MISSIONS[id];
  if (def.cadence === "once") return `once:${id}`;
  if (def.cadence === "unlimited") return `unlimited:${id}:${nowMs}`;
  const kst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(nowMs));
  if (def.cadence === "daily") return `daily:${id}:${kst}`;
  return `hours24:${id}:${kst}`;
}

function toastMissionReward(result: MissionRewardResult, id: MissionId) {
  dispatchMissionToast(missionCompleteToastMessage(id, { couponPending: result.couponPending }));
}

/** 미션 완료 보상 — 게스트는 로컬, 로그인은 서버 지갑 기준 */
export async function applyMissionReward(id: MissionId, nowMs = Date.now()): Promise<MissionRewardResult> {
  const credits = missionRewardCredits(id);
  const result: MissionRewardResult = {
    credits: 0,
    couponGranted: false,
    couponPending: false,
    serverSynced: false,
  };

  const sb = supabaseBrowser();
  const session = sb ? (await sb.auth.getSession()).data.session : null;

  if (!session?.access_token) {
    if (credits > 0) {
      applyBonusCredits(credits);
      result.credits = credits;
    }
    toastMissionReward(result, id);
    return result;
  }

  try {
    const res = await fetch("/api/missions/reward", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mission_id: id,
        grant_key: buildGrantKey(id, nowMs),
        cadence: MISSIONS[id].cadence,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      credits_granted?: number;
      credits_duplicate?: boolean;
      coupon?: { granted?: boolean; pending?: boolean };
    };
    if (res.ok && data.ok) {
      if (typeof data.credits_granted === "number" && data.credits_granted > 0) {
        result.credits = data.credits_granted;
      }
      result.couponGranted = Boolean(data.coupon?.granted);
      result.couponPending = Boolean(data.coupon?.pending);
      result.serverSynced = await syncCreditsFromServer();
    }
  } catch {
    /* ignore */
  }

  toastMissionReward(result, id);
  try {
    window.dispatchEvent(new CustomEvent("yeonun:coupons-updated"));
  } catch {
    /* ignore */
  }
  return result;
}

/** @deprecated applyMissionReward 사용 */
export function applyMissionCreditReward(id: MissionId): number {
  void applyMissionReward(id);
  return missionRewardCredits(id);
}

/** 출석 7일 보상 등 — 크레딧 수치(기존 필드명 voiceSecondsAdded와 호환 위해 숫자만 전달) */
export function applyAttendanceCreditReward(credits: number): number {
  if (credits <= 0) return 0;
  applyBonusCredits(credits);
  return credits;
}
