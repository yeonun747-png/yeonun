/**
 * 출석 UI·API 공통: 스탬프/배지 표시용 순수 계산 (KST).
 */

export function computeStampDisplay(input: {
  todayKst: string;
  yesterdayKst: string;
  lastKst: string | null;
  streakDb: number;
  attendedToday: boolean;
}): { filled: number; pulseIndex: number | null } {
  const { yesterdayKst, lastKst, streakDb, attendedToday } = input;
  if (attendedToday) {
    return { filled: streakDb, pulseIndex: null };
  }
  if (lastKst === yesterdayKst) {
    return { filled: streakDb, pulseIndex: streakDb + 1 };
  }
  return { filled: 0, pulseIndex: 1 };
}

export function badgeStreak(input: {
  lastKst: string | null;
  yesterdayKst: string;
  streakDb: number;
  attendedToday: boolean;
}): number {
  const { lastKst, yesterdayKst, streakDb, attendedToday } = input;
  if (attendedToday) return streakDb;
  if (lastKst === yesterdayKst) return streakDb;
  return 0;
}
