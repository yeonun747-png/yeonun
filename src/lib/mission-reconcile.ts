/**
 * 오늘 탭 밖에서 수행한 행동 → 미션 완료/보상 반영.
 * localStorage 사실 플래그 + 사주 유무로 동기화 (daily-missions ↔ mission-rewards 순환 import 방지용 분리 모듈).
 */

import {
  defaultMissionState,
  isMissionCompleted,
  markMissionCompleteInState,
  MISSION_STORAGE_KEY,
  syncMissionState,
  type MissionId,
  type MissionRuntimeState,
} from "@/lib/daily-missions";
import { applyMissionCreditReward } from "@/lib/mission-rewards";
import { formatKstDateKey } from "@/lib/datetime/kst";

export const YEONUN_MISSIONS_RECONCILE_EVENT = "yeonun:missions-reconcile";

const SAJU_LS_KEY = "yeonun_saju_v1";
const LEGACY_MISSION_KEY = "yeonun_daily_missions_v1";

function loadMissionRuntimeStateForExternal(now: Date): MissionRuntimeState | null {
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
    const p = JSON.parse(raw) as Partial<MissionRuntimeState> & { lastAssigned24hMs?: unknown };
    const signup =
      typeof p.signupKstDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.signupKstDate)
        ? p.signupKstDate
        : today;
    const base = defaultMissionState(signup);
    const lastCompletedAtMs =
      p.lastCompletedAtMs && typeof p.lastCompletedAtMs === "object"
        ? (p.lastCompletedAtMs as MissionRuntimeState["lastCompletedAtMs"])
        : {};
    return {
      ...base,
      ...p,
      signupKstDate: signup,
      rolledDayKst: typeof p.rolledDayKst === "string" ? p.rolledDayKst : base.rolledDayKst,
      rolledIds: Array.isArray(p.rolledIds) ? (p.rolledIds as MissionId[]) : base.rolledIds,
      completedOnce: { ...base.completedOnce, ...p.completedOnce },
      completedToday: { ...base.completedToday, ...p.completedToday },
      lastCompletedAtMs: { ...base.lastCompletedAtMs, ...lastCompletedAtMs },
    };
  } catch {
    return null;
  }
}

/** 오늘의 미션에 M07이 있고 미완료일 때만 LS·보상·토스트 반영(만남·음성·채팅 탭에서 호출) */
export function tryPersistMissionM07CompleteIfEligible(now: Date = new Date()): void {
  if (typeof window === "undefined") return;
  const state0 = loadMissionRuntimeStateForExternal(now);
  if (!state0) return;
  const { trio, state: s0 } = syncMissionState(now, state0);
  const id: MissionId = "M07";
  if (!trio.some((t) => t.id === id)) return;
  if (isMissionCompleted(id, s0.completedOnce, s0.completedToday)) return;
  applyMissionCreditReward(id);
  const marked = markMissionCompleteInState(s0, id, trio, now.getTime());
  const { state: s2 } = syncMissionState(now, marked);
  try {
    localStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(s2));
  } catch {
    /* ignore */
  }
  dispatchMissionsReconcile();
  try {
    window.dispatchEvent(new CustomEvent("yeonun:toast", { detail: { message: "미션 완료 · 보상이 적립됐어요" } }));
  } catch {
    /* ignore */
  }
}

export function missionFactM03Key(kst: string): string {
  return `yeonun:mission-fact:m03-iljin:${kst}`;
}

export function missionFactM04Key(kst: string): string {
  return `yeonun:mission-fact:m04-daily-words:${kst}`;
}

export function missionFactM10Key(kst: string): string {
  return `yeonun:mission-fact:m10-manse:${kst}`;
}

export function dispatchMissionsReconcile(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(YEONUN_MISSIONS_RECONCILE_EVENT));
  } catch {
    /* ignore */
  }
}

function readFact(k: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(k) === "1";
  } catch {
    return false;
  }
}

function missionFactHasValidSaju(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(SAJU_LS_KEY);
    if (!raw) return false;
    const j = JSON.parse(raw) as { year?: string; month?: string; day?: string };
    return !!(j?.year && j?.month && j?.day);
  } catch {
    return false;
  }
}

function missionFactForId(id: MissionId, todayKst: string): boolean {
  switch (id) {
    case "M01":
      return missionFactHasValidSaju();
    case "M03":
      return readFact(missionFactM03Key(todayKst));
    case "M04":
      return readFact(missionFactM04Key(todayKst));
    case "M10":
      return readFact(missionFactM10Key(todayKst));
    default:
      return false;
  }
}

/**
 * LS에 저장된 미션 상태를 기준으로, 다른 화면에서 쌓인 완료 사실을 반영하고 보상을 한 번만 지급합니다.
 */
export function reconcileMissionStateWithExternalFacts(now: Date, state: MissionRuntimeState): MissionRuntimeState {
  const nowMs = now.getTime();
  const todayKst = formatKstDateKey(now);
  let s = syncMissionState(now, state).state;
  const { trio } = syncMissionState(now, s);

  for (const m of trio) {
    const id = m.id;
    if (isMissionCompleted(id, s.completedOnce, s.completedToday)) continue;
    if (!missionFactForId(id, todayKst)) continue;
    applyMissionCreditReward(id);
    s = markMissionCompleteInState(s, id, trio, nowMs);
  }

  return syncMissionState(now, s).state;
}

export function markMissionFactM03ViewedNow(): void {
  const kst = formatKstDateKey(new Date());
  try {
    window.localStorage.setItem(missionFactM03Key(kst), "1");
  } catch {
    /* ignore */
  }
  dispatchMissionsReconcile();
}

export function markMissionFactM04ReadNow(): void {
  const kst = formatKstDateKey(new Date());
  try {
    window.localStorage.setItem(missionFactM04Key(kst), "1");
  } catch {
    /* ignore */
  }
  dispatchMissionsReconcile();
}

export function markMissionFactM10ManseViewedNow(): void {
  const kst = formatKstDateKey(new Date());
  try {
    window.localStorage.setItem(missionFactM10Key(kst), "1");
  } catch {
    /* ignore */
  }
  dispatchMissionsReconcile();
}

export function missionStorageKeysThatTriggerReconcile(key: string | null): boolean {
  if (!key) return false;
  if (key === MISSION_STORAGE_KEY) return true;
  if (key.startsWith("yeonun:mission-fact:")) return true;
  if (key === SAJU_LS_KEY) return true;
  return false;
}
