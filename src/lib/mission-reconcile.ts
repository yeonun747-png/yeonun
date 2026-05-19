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
import { formatKstDateKey } from "@/lib/datetime/kst";
import { getNoteByKstDate } from "@/lib/daily-notes-catalog";
import { loadMissionRuntimeState, missionM04AllCardsRead, readMissionFact, dispatchMissionsReconcile } from "@/lib/mission-complete";
import { applyMissionReward } from "@/lib/mission-rewards";

export { YEONUN_MISSIONS_RECONCILE_EVENT, dispatchMissionsReconcile } from "@/lib/mission-complete";

/** M02 — 첫 음성 상담 시작(세션 생성 성공) */
export const MISSION_FACT_M02_STARTED_KEY = "yeonun_first_voice_started_v1";
/** 레거시 — 통화 종료 시점에만 기록되던 플래그(하위 호환) */
export const MISSION_FACT_M02_LEGACY_ENDED_KEY = "yeonun_first_voice_completed_v1";

const SAJU_LS_KEY = "yeonun_saju_v1";
const LEGACY_MISSION_KEY = "yeonun_daily_missions_v1";

function loadMissionRuntimeStateForExternal(now: Date): MissionRuntimeState | null {
  return loadMissionRuntimeState(now);
}

async function persistMissionCompleteIfEligible(id: MissionId, now: Date = new Date()): Promise<void> {
  if (typeof window === "undefined") return;
  const state0 = loadMissionRuntimeStateForExternal(now);
  if (!state0) return;
  const { trio, state: s0 } = syncMissionState(now, state0);
  if (!trio.some((t) => t.id === id)) return;
  if (isMissionCompleted(id, s0.completedOnce, s0.completedToday)) return;
  await applyMissionReward(id, now.getTime());
  const marked = markMissionCompleteInState(s0, id, trio, now.getTime());
  const { state: s2 } = syncMissionState(now, marked);
  try {
    localStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(s2));
  } catch {
    /* ignore */
  }
  dispatchMissionsReconcile();
}

/** 오늘의 미션에 M07이 있고 미완료일 때만 — **처음** 음성 상담한 캐릭터일 때만 */
export function tryPersistMissionM07CompleteIfEligible(now: Date = new Date(), wasNewCharacter = true): void {
  if (!wasNewCharacter) return;
  void persistMissionCompleteIfEligible("M07", now);
}

/** 오늘의 미션에 M02가 있고 미완료일 때 — 음성 상담 세션 시작 직후 호출 */
export function tryPersistMissionM02CompleteIfEligible(now: Date = new Date()): void {
  void persistMissionCompleteIfEligible("M02", now);
}

/** 음성 상담 세션이 생성·시작됐음을 기록하고 M02 미션을 즉시 반영 */
export function markFirstVoiceStartedForMission(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MISSION_FACT_M02_STARTED_KEY, "1");
  } catch {
    /* ignore */
  }
  tryPersistMissionM02CompleteIfEligible();
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

function missionFactHasTodayDailyNote(todayKst: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const note = getNoteByKstDate(todayKst);
    return Boolean(note?.body?.trim());
  } catch {
    return false;
  }
}

function missionFactForId(id: MissionId, todayKst: string): boolean {
  switch (id) {
    case "M01":
      return missionFactHasValidSaju();
    case "M02":
      return readFact(MISSION_FACT_M02_STARTED_KEY) || readFact(MISSION_FACT_M02_LEGACY_ENDED_KEY);
    case "M03":
      return readFact(missionFactM03Key(todayKst));
    case "M04":
      return missionM04AllCardsRead(todayKst) || readFact(missionFactM04Key(todayKst));
    case "M05":
      return readMissionFact("m05-dream", todayKst) || readMissionFact("m05-dream-library", todayKst);
    case "M06":
      return readMissionFact("m06-review", todayKst);
    case "M09":
      return readMissionFact("m09-content-purchase", todayKst);
    case "M10":
      return readFact(missionFactM10Key(todayKst));
    case "M11":
      return readMissionFact("m11-daily-record", todayKst) || missionFactHasTodayDailyNote(todayKst);
    case "M12":
      return readMissionFact("m12-daily-words-share", todayKst);
    default:
      return false;
  }
}

/**
 * LS에 저장된 미션 상태를 기준으로, 다른 화면에서 쌓인 완료 사실을 반영하고 보상을 한 번만 지급합니다.
 */
export async function reconcileMissionStateWithExternalFacts(
  now: Date,
  state: MissionRuntimeState,
): Promise<MissionRuntimeState> {
  const nowMs = now.getTime();
  const todayKst = formatKstDateKey(now);
  let s = syncMissionState(now, state).state;
  const { trio } = syncMissionState(now, s);

  for (const m of trio) {
    const id = m.id;
    if (isMissionCompleted(id, s.completedOnce, s.completedToday)) continue;
    if (!missionFactForId(id, todayKst)) continue;
    await applyMissionReward(id, nowMs);
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

/** @deprecated M04는 카드별 열람 사용 — markMissionM04CardViewed */
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
  if (key === MISSION_FACT_M02_STARTED_KEY || key === MISSION_FACT_M02_LEGACY_ENDED_KEY) return true;
  if (key === SAJU_LS_KEY) return true;
  if (key === "yeonun_daily_notes_catalog_v1") return true;
  return false;
}

export { LEGACY_MISSION_KEY };
