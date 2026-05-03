/**
 * Supabase 세션 없이 auth-stub만 켜진 경우(개발용 소셜 플로우) 출석 UI용 로컬 폴백.
 * 서버 DB와 별개이며, 실제 계정 연동 시 서버 출석으로 대체됨.
 */

import {
  attendanceVoiceRewardCredits,
  cycleRewardLineKo,
  rewardKindForCycle,
  type AttendanceRewardKind,
} from "@/lib/attendance-rewards";
import { badgeStreak, computeStampDisplay } from "@/lib/attendance-sync-core";
import { addKstCalendarDays, formatKstDateKey } from "@/lib/datetime/kst";

const LS_KEY = "yeonun_attendance_stub_v1";

type Stored = {
  streak: number;
  cycle: number;
  last_attendance_kst_date: string | null;
  attendedDays: string[];
};

function load(): Stored {
  if (typeof window === "undefined") {
    return { streak: 0, cycle: 1, last_attendance_kst_date: null, attendedDays: [] };
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      return { streak: 0, cycle: 1, last_attendance_kst_date: null, attendedDays: [] };
    }
    const p = JSON.parse(raw) as Partial<Stored>;
    return {
      streak: typeof p.streak === "number" ? p.streak : 0,
      cycle: typeof p.cycle === "number" && p.cycle >= 1 ? p.cycle : 1,
      last_attendance_kst_date:
        typeof p.last_attendance_kst_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.last_attendance_kst_date)
          ? p.last_attendance_kst_date
          : null,
      attendedDays: Array.isArray(p.attendedDays) ? p.attendedDays.filter((x) => typeof x === "string") : [],
    };
  } catch {
    return { streak: 0, cycle: 1, last_attendance_kst_date: null, attendedDays: [] };
  }
}

function save(s: Stored) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export type LocalAttendancePayload = {
  ok: true;
  todayKst: string;
  attendedToday: boolean;
  streak: number;
  cycle: number;
  badgeStreak: number;
  daysUntilSeven: number;
  stampFilled: number;
  stampPulseIndex: number | null;
  cycleRewardLine: string;
  completedSeven: boolean;
  rewardKind: AttendanceRewardKind | null;
  couponPendingFromReward: boolean;
  voiceSecondsAdded: number;
  pendingCouponGranted: boolean;
  couponPending: boolean;
  nextCyclePreviewLine: string;
  isLocalStub: true;
};

function buildPayload(
  todayKst: string,
  yesterdayKst: string,
  state: Stored,
  attendedToday: boolean,
  extras: {
    completedSeven: boolean;
    rewardKind: AttendanceRewardKind | null;
    couponPendingFromReward: boolean;
    voiceSecondsAdded: number;
    pendingCouponGranted: boolean;
  },
): LocalAttendancePayload {
  const stamp = computeStampDisplay({
    todayKst,
    yesterdayKst,
    lastKst: state.last_attendance_kst_date,
    streakDb: state.streak,
    attendedToday,
  });
  const badge = badgeStreak({
    lastKst: state.last_attendance_kst_date,
    yesterdayKst,
    streakDb: state.streak,
    attendedToday,
  });
  const daysUntilSeven = Math.max(0, 7 - badge);
  return {
    ok: true,
    todayKst,
    attendedToday,
    streak: state.streak,
    cycle: state.cycle,
    badgeStreak: badge,
    daysUntilSeven,
    stampFilled: stamp.filled,
    stampPulseIndex: stamp.pulseIndex,
    cycleRewardLine: cycleRewardLineKo(state.cycle),
    completedSeven: extras.completedSeven,
    rewardKind: extras.rewardKind,
    couponPendingFromReward: extras.couponPendingFromReward,
    voiceSecondsAdded: extras.voiceSecondsAdded,
    pendingCouponGranted: extras.pendingCouponGranted,
    couponPending: false,
    nextCyclePreviewLine: cycleRewardLineKo(state.cycle),
    isLocalStub: true,
  };
}

export function syncLocalAttendanceStub(now: Date): LocalAttendancePayload {
  const todayKst = formatKstDateKey(now);
  const yesterdayKst = addKstCalendarDays(todayKst, -1);

  let state = load();
  const attendedToday = state.attendedDays.includes(todayKst);

  if (attendedToday) {
    return buildPayload(todayKst, yesterdayKst, state, true, {
      completedSeven: false,
      rewardKind: null,
      couponPendingFromReward: false,
      voiceSecondsAdded: 0,
      pendingCouponGranted: false,
    });
  }

  let newStreak = state.last_attendance_kst_date === yesterdayKst ? state.streak + 1 : 1;

  let cycle = state.cycle;
  let completedSeven = false;
  let rewardKind: AttendanceRewardKind | null = null;
  let couponPendingFromReward = false;
  let voiceSecondsAdded = 0;

  if (newStreak === 7) {
    completedSeven = true;
    rewardKind = rewardKindForCycle(cycle);
    if (rewardKind === "voice_5min") {
      voiceSecondsAdded = attendanceVoiceRewardCredits();
    } else if (rewardKind === "coupon_5pct") {
      couponPendingFromReward = true;
    }
    newStreak = 1;
    cycle = cycle + 1;
  }

  const next: Stored = {
    streak: newStreak,
    cycle,
    last_attendance_kst_date: todayKst,
    attendedDays: [...state.attendedDays, todayKst],
  };

  save(next);
  state = next;

  return buildPayload(todayKst, yesterdayKst, state, true, {
    completedSeven,
    rewardKind,
    couponPendingFromReward,
    voiceSecondsAdded,
    pendingCouponGranted: false,
  });
}
