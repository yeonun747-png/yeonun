/**
 * 미션 완료 persist + 보상 공통 헬퍼
 */

import {
  defaultMissionState,
  isMissionCompleted,
  markMissionCompleteInState,
  MISSIONS,
  MISSION_STORAGE_KEY,
  syncMissionState,
  type MissionId,
  type MissionRuntimeState,
} from "@/lib/daily-missions";
import { formatKstDateKey } from "@/lib/datetime/kst";
import { applyMissionReward } from "@/lib/mission-rewards";
import { readM08AssignedKst } from "@/lib/referral-pending";

export const YEONUN_MISSIONS_RECONCILE_EVENT = "yeonun:missions-reconcile";

export function dispatchMissionsReconcile(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(YEONUN_MISSIONS_RECONCILE_EVENT));
  } catch {
    /* ignore */
  }
}

const LEGACY_MISSION_KEY = "yeonun_daily_missions_v1";

export function loadMissionRuntimeState(now: Date = new Date()): MissionRuntimeState | null {
  if (typeof window === "undefined") return null;
  const today = formatKstDateKey(now);
  try {
    let raw = localStorage.getItem(MISSION_STORAGE_KEY);
    if (!raw) raw = localStorage.getItem(LEGACY_MISSION_KEY);
    if (!raw) {
      const s = defaultMissionState(today);
      localStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(s));
      return s;
    }
    const p = JSON.parse(raw) as Partial<MissionRuntimeState>;
    const signup =
      typeof p.signupKstDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.signupKstDate)
        ? p.signupKstDate
        : today;
    const base = defaultMissionState(signup);
    return {
      ...base,
      ...p,
      signupKstDate: signup,
      rolledDayKst: typeof p.rolledDayKst === "string" ? p.rolledDayKst : base.rolledDayKst,
      rolledIds: Array.isArray(p.rolledIds) ? (p.rolledIds as MissionId[]) : base.rolledIds,
      completedOnce: { ...base.completedOnce, ...p.completedOnce },
      completedToday: { ...base.completedToday, ...p.completedToday },
      lastCompletedAtMs: { ...base.lastCompletedAtMs, ...p.lastCompletedAtMs },
    };
  } catch {
    return null;
  }
}

/** 오늘 배정된 미션이면 완료·보상·저장 */
export async function tryCompleteMissionIfEligible(
  id: MissionId,
  now: Date = new Date(),
  opts?: { skipReward?: boolean },
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const state0 = loadMissionRuntimeState(now);
  if (!state0) return false;
  const { trio, state: s0 } = syncMissionState(now, state0);
  if (!trio.some((t) => t.id === id)) return false;
  if (isMissionCompleted(id, s0.completedOnce, s0.completedToday)) return false;

  const nowMs = now.getTime();
  if (!opts?.skipReward) {
    await applyMissionReward(id, nowMs);
  }
  const marked = markMissionCompleteInState(s0, id, trio, nowMs);
  const { state: s2 } = syncMissionState(now, marked);
  try {
    localStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(s2));
  } catch {
    /* ignore */
  }
  dispatchMissionsReconcile();
  return true;
}

export function missionFactKey(prefix: string, kst?: string): string {
  return `yeonun:mission-fact:${prefix}:${kst ?? formatKstDateKey(new Date())}`;
}

export function markMissionFact(prefix: string, kst?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(missionFactKey(prefix, kst), "1");
  } catch {
    /* ignore */
  }
  dispatchMissionsReconcile();
}

export function readMissionFact(prefix: string, kst?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(missionFactKey(prefix, kst)) === "1";
  } catch {
    return false;
  }
}

/** M04 — 4명 카드 개별 열람 */
const M04_CHAR_KEYS = ["yeon", "byeol", "yeo", "un"] as const;

export function markMissionM04CardViewed(charKey: string, kst?: string): boolean {
  const k = String(charKey).trim();
  if (!M04_CHAR_KEYS.includes(k as (typeof M04_CHAR_KEYS)[number])) return false;
  const today = kst ?? formatKstDateKey(new Date());
  markMissionFact(`m04-card:${k}`, today);
  const allRead = M04_CHAR_KEYS.every((c) => readMissionFact(`m04-card:${c}`, today));
  if (allRead) markMissionFact("m04-daily-words", today);
  return allRead;
}

export function missionM04AllCardsRead(kst?: string): boolean {
  const today = kst ?? formatKstDateKey(new Date());
  return readMissionFact("m04-daily-words", today);
}

export async function onMissionProductPaid(productSlug: string): Promise<void> {
  const today = formatKstDateKey(new Date());
  if (productSlug === "dream-lastnight") {
    markMissionFact("m05-dream", today);
    await tryCompleteMissionIfEligible("M05");
    return;
  }
  if (!productSlug.startsWith("credit")) {
    markMissionFact("m09-content-purchase", today);
    await tryCompleteMissionIfEligible("M09");
  }
}

export async function onMissionDreamLibraryViewed(): Promise<void> {
  markMissionFact("m05-dream-library", formatKstDateKey(new Date()));
  await tryCompleteMissionIfEligible("M05");
}

export async function onMissionReviewSubmitted(): Promise<void> {
  markMissionFact("m06-review", formatKstDateKey(new Date()));
  await tryCompleteMissionIfEligible("M06");
}

export async function syncMissionM08FromServer(accessToken: string): Promise<boolean> {
  const assigned = readM08AssignedKst();
  try {
    const res = await fetch(`/api/referral/status?assigned_kst=${encodeURIComponent(assigned)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; completed?: boolean };
    return Boolean(res.ok && data.ok && data.completed);
  } catch {
    return false;
  }
}

export async function onMissionReferralCompleted(): Promise<void> {
  markMissionFact("m08-referral", formatKstDateKey(new Date()));
  await tryCompleteMissionIfEligible("M08");
}

export function missionCadenceLabel(id: MissionId): string {
  return MISSIONS[id]?.cadence ?? "daily";
}
