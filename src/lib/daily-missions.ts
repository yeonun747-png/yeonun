/**
 * 오늘의 미션 M01–M12 (KST 자정 기준).
 * 신규 첫날(KST): M01+M02+M03 고정.
 * 기존 회원: 후보 풀에서 3개 랜덤(후보 3 미만이면 가능한 수만큼).
 */

import { formatKstDateKey } from "@/lib/datetime/kst";

export type MissionId =
  | "M01"
  | "M02"
  | "M03"
  | "M04"
  | "M05"
  | "M06"
  | "M07"
  | "M08"
  | "M09"
  | "M10"
  | "M11"
  | "M12";

export type MissionCadence = "once" | "daily" | "hours24" | "unlimited";

export type MissionDef = {
  id: MissionId;
  name: string;
  reward: string;
  cadence: MissionCadence;
};

export const MISSIONS: Record<MissionId, MissionDef> = {
  M01: { id: "M01", name: "내 사주 입력하기", reward: "풀이 5,000원 할인 쿠폰", cadence: "once" },
  M02: { id: "M02", name: "첫 음성 상담 시작", reward: "음성 +5분", cadence: "once" },
  M03: { id: "M03", name: "오늘의 일진 확인", reward: "음성 +1분", cadence: "daily" },
  M04: { id: "M04", name: "4명 한 마디 모두 읽기", reward: "음성 +1분", cadence: "daily" },
  M05: { id: "M05", name: "꿈해몽 풀이 보기", reward: "다음 꿈해몽 무료 쿠폰", cadence: "hours24" },
  M06: { id: "M06", name: "후기 작성하기", reward: "음성 +5분", cadence: "hours24" },
  M07: { id: "M07", name: "처음 만나는 인연과 상담", reward: "음성 +3분", cadence: "hours24" },
  M08: { id: "M08", name: "친구 초대", reward: "초대자·가입자 각 +10분", cadence: "unlimited" },
  M09: { id: "M09", name: "콘텐츠 1개 구매", reward: "다음 콘텐츠 10% 할인", cadence: "hours24" },
  M10: { id: "M10", name: "만세력 분석 보기", reward: "음성 +1분", cadence: "daily" },
  M11: { id: "M11", name: "오늘의 운세 기록", reward: "음성 +1분", cadence: "daily" },
  M12: { id: "M12", name: "오늘의 한 마디 공유", reward: "음성 +1분", cadence: "hours24" },
};

/** 목업: 미완료는 장미 톤 알약 + 설명 / 완료는 초록 「완료」 알약 + 적립 문구 */
export type MissionUiLines = {
  badgeTodo: string;
  descTodo: string;
  descDone: string;
};

export const MISSION_UI_LINES: Record<MissionId, MissionUiLines> = {
  M01: {
    badgeTodo: "+5,000원 할인",
    descTodo: "만세력 + 풀이 콘텐츠 할인",
    descDone: "5,000원 할인 쿠폰 적립됨",
  },
  M02: {
    badgeTodo: "+5분",
    descTodo: "음성 상담 5분 적립",
    descDone: "음성 5분 적립됨",
  },
  M03: {
    badgeTodo: "+1분",
    descTodo: "음성 상담 1분 적립",
    descDone: "음성 1분 적립됨",
  },
  M04: {
    badgeTodo: "+1분",
    descTodo: "음성 상담 1분 적립",
    descDone: "음성 1분 적립됨",
  },
  M05: {
    badgeTodo: "무료쿠폰",
    descTodo: "다음 꿈해몽 무료 쿠폰 지급",
    descDone: "꿈해몽 무료 쿠폰 적립됨",
  },
  M06: {
    badgeTodo: "+5분",
    descTodo: "음성 상담 5분 적립",
    descDone: "음성 5분 적립됨",
  },
  M07: {
    badgeTodo: "+3분",
    descTodo: "음성 상담 3분 적립",
    descDone: "음성 3분 적립됨",
  },
  M08: {
    badgeTodo: "+10분",
    descTodo: "나 + 친구 각각 10분 적립",
    descDone: "양쪽 10분 적립됨",
  },
  M09: {
    badgeTodo: "10% 할인",
    descTodo: "다음 콘텐츠 10% 할인 쿠폰",
    descDone: "10% 할인 쿠폰 적립됨",
  },
  M10: {
    badgeTodo: "+1분",
    descTodo: "음성 상담 1분 적립",
    descDone: "음성 1분 적립됨",
  },
  M11: {
    badgeTodo: "+1분",
    descTodo: "음성 상담 1분 적립",
    descDone: "음성 1분 적립됨",
  },
  M12: {
    badgeTodo: "+1분",
    descTodo: "음성 상담 1분 적립",
    descDone: "음성 1분 적립됨",
  },
};

export function missionUiLines(id: MissionId): MissionUiLines {
  return MISSION_UI_LINES[id];
}

export const ONBOARDING_MISSION_IDS: MissionId[] = ["M01", "M02", "M03"];

/** 매일 후보에 항상 포함 */
const DAILY_MISSION_IDS: MissionId[] = ["M03", "M04", "M10", "M11"];

const ONCE_IDS: MissionId[] = ["M01", "M02"];

/** 마지막 완료 시각 기준 24시간 쿨다운 */
export const HOURS24_IDS = new Set<MissionId>(["M05", "M06", "M07", "M09", "M12"]);

const MS_24H = 24 * 60 * 60 * 1000;

export type MissionRuntimeState = {
  signupKstDate: string;
  rolledDayKst: string | null;
  rolledIds: MissionId[];
  completedOnce: Partial<Record<MissionId, boolean>>;
  completedToday: Partial<Record<MissionId, boolean>>;
  /** 24시간 주기 미션: 마지막 완료 시각(ms) */
  lastCompletedAtMs: Partial<Record<MissionId, number>>;
};

export const MISSION_STORAGE_KEY = "yeonun_daily_missions_v2";

export function defaultMissionState(signupKstDate: string): MissionRuntimeState {
  return {
    signupKstDate,
    rolledDayKst: null,
    rolledIds: [],
    completedOnce: {},
    completedToday: {},
    lastCompletedAtMs: {},
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) >>> 0 || 1;
}

export function seededShuffleMissionIds(pool: MissionId[], seed: string): MissionId[] {
  const arr = [...pool];
  let state = hashSeed(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    const j = state % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 음성 상담 완료한 캐릭터 키 — M07 후보 조건 */
export const VOICE_CHARS_CONSULTED_KEY = "yeonun_voice_chars_consulted_v1";

export function m07EligibleForPool(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(VOICE_CHARS_CONSULTED_KEY);
    const consulted = new Set<string>(Array.isArray(JSON.parse(raw || "[]")) ? JSON.parse(raw || "[]") : []);
    return (["yeon", "byeol", "yeo", "un"] as const).some((k) => !consulted.has(k));
  } catch {
    return true;
  }
}

function hours24Eligible(id: MissionId, nowMs: number, lastCompleted: Partial<Record<MissionId, number>>): boolean {
  const t = lastCompleted[id];
  if (t == null) return true;
  return nowMs - t >= MS_24H;
}

export function buildMissionCandidatePool(state: MissionRuntimeState, nowMs: number): MissionId[] {
  const pool = new Set<MissionId>();

  for (const id of DAILY_MISSION_IDS) pool.add(id);

  pool.add("M08");

  for (const id of ONCE_IDS) {
    if (!state.completedOnce[id]) pool.add(id);
  }

  for (const id of HOURS24_IDS) {
    if (id === "M07") {
      if (m07EligibleForPool() && hours24Eligible(id, nowMs, state.lastCompletedAtMs)) pool.add(id);
    } else if (hours24Eligible(id, nowMs, state.lastCompletedAtMs)) {
      pool.add(id);
    }
  }

  return Array.from(pool);
}

function pickDailyTrio(
  todayKst: string,
  signupKstDate: string,
  nowMs: number,
  state: MissionRuntimeState,
): MissionId[] {
  const pool = buildMissionCandidatePool(state, nowMs);
  if (pool.length === 0) return [];
  const seed = `${todayKst}|${signupKstDate}`;
  const shuffled = seededShuffleMissionIds(pool, seed);
  const n = Math.min(3, shuffled.length);
  return shuffled.slice(0, n);
}

export function isMissionCompleted(
  id: MissionId,
  completedOnce: Partial<Record<MissionId, boolean>>,
  completedToday: Partial<Record<MissionId, boolean>>,
): boolean {
  const def = MISSIONS[id];
  if (def.cadence === "once") return Boolean(completedOnce[id]);
  return Boolean(completedToday[id]);
}

export function syncMissionState(now: Date, state: MissionRuntimeState): {
  state: MissionRuntimeState;
  trio: MissionDef[];
  mode: "onboarding" | "daily";
  allComplete: boolean;
} {
  const todayKst = formatKstDateKey(now);
  const nowMs = now.getTime();
  let next: MissionRuntimeState = {
    ...state,
    completedOnce: { ...state.completedOnce },
    completedToday: { ...state.completedToday },
    lastCompletedAtMs: { ...state.lastCompletedAtMs },
    rolledIds: [...state.rolledIds],
  };

  const onboarding = todayKst === next.signupKstDate;
  let trio: MissionDef[];

  if (onboarding) {
    trio = ONBOARDING_MISSION_IDS.map((id) => MISSIONS[id]);
  } else {
    if (next.rolledDayKst !== todayKst) {
      const picked = pickDailyTrio(todayKst, next.signupKstDate, nowMs, next);
      next = {
        ...next,
        rolledDayKst: todayKst,
        rolledIds: picked,
        completedToday: {},
      };
    }
    trio = next.rolledIds.map((id) => MISSIONS[id]).filter(Boolean);
    if (trio.length === 0) {
      const picked = pickDailyTrio(todayKst, next.signupKstDate, nowMs, next);
      next = {
        ...next,
        rolledDayKst: todayKst,
        rolledIds: picked,
        completedToday: {},
      };
      trio = picked.map((id) => MISSIONS[id]);
    }
  }

  const allComplete =
    trio.length > 0 && trio.every((m) => isMissionCompleted(m.id, next.completedOnce, next.completedToday));

  return { state: next, trio, mode: onboarding ? "onboarding" : "daily", allComplete };
}

export function missionCtaLabel(id: MissionId): string {
  const labels: Record<MissionId, string> = {
    M01: "시작",
    M02: "시작",
    M03: "확인",
    M04: "확인",
    M05: "보러가기",
    M06: "작성",
    M07: "만나기",
    M08: "초대",
    M09: "보러가기",
    M10: "보기",
    M11: "기록",
    M12: "공유",
  };
  return labels[id] ?? "시작";
}

/** 미션 행 CTA 이동 (기존 라우트) */
export function missionActionHref(id: MissionId): string {
  switch (id) {
    case "M01":
    case "M10":
      return "/my?modal=saju";
    case "M02":
    case "M07":
      return "/meet";
    case "M03":
      return "/today#today-iljin";
    case "M04":
    case "M12":
      return "/today#today-daily-words";
    case "M05":
      return "/content?category=dream";
    case "M06":
      return "/reviews";
    case "M08":
      return "/partner";
    case "M09":
      return "/content";
    case "M11":
      return "/today#today-daily-record";
    default:
      return "/today";
  }
}

export function markMissionCompleteInState(
  state: MissionRuntimeState,
  id: MissionId,
  trio: MissionDef[],
  nowMs: number,
): MissionRuntimeState {
  if (!trio.some((t) => t.id === id)) return state;
  const def = MISSIONS[id];
  let lastCompletedAtMs = { ...state.lastCompletedAtMs };
  if (HOURS24_IDS.has(id) || def.cadence === "hours24") {
    lastCompletedAtMs[id] = nowMs;
  }
  if (def.cadence === "once") {
    return { ...state, completedOnce: { ...state.completedOnce, [id]: true }, lastCompletedAtMs };
  }
  return {
    ...state,
    completedToday: { ...state.completedToday, [id]: true },
    lastCompletedAtMs,
  };
}

/** 완료 시 음성 보너스(초). 0이면 음성 외 보상 */
export function missionVoiceRewardSec(id: MissionId): number {
  switch (id) {
    case "M02":
      return 5 * 60;
    case "M03":
    case "M04":
    case "M10":
    case "M11":
    case "M12":
      return 60;
    case "M06":
      return 5 * 60;
    case "M07":
      return 3 * 60;
    default:
      return 0;
  }
}
