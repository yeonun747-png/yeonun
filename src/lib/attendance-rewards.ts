/** 출석 7일 보상 종류 (사이클 번호로 결정) */
export type AttendanceRewardKind = "voice_5min" | "coupon_5pct" | "dream_once";

const VOICE_SEC = 300;

export function attendanceVoiceRewardSeconds(): number {
  return VOICE_SEC;
}

/** cycle 번호(1부터)에 해당하는 이번 7일 완주 보상 */
export function rewardKindForCycle(cycle: number): AttendanceRewardKind {
  const pos = ((cycle - 1) % 6) + 1;
  if (pos === 4) return "dream_once";
  if (pos === 2 || pos === 6) return cycle >= 7 ? "voice_5min" : "coupon_5pct";
  return "voice_5min";
}

/** 스탬프 아래 1줄: 이번 사이클에서 7일 달성 시 받을 보상 안내 */
export function cycleRewardLineKo(cycle: number): string {
  const k = rewardKindForCycle(cycle);
  if (k === "coupon_5pct") return "7일 연속 달성 보상: 콘텐츠 5% 할인 쿠폰";
  if (k === "dream_once") return "7일 연속 달성 보상: 무료 꿈해몽 풀이 1회";
  return "7일 연속 달성 보상: 음성 상담 5분 추가";
}

export function rewardModalTitleKo(kind: AttendanceRewardKind): string {
  switch (kind) {
    case "voice_5min":
      return "음성 상담 5분 추가";
    case "coupon_5pct":
      return "콘텐츠 5% 할인 쿠폰";
    case "dream_once":
      return "무료 꿈해몽 풀이 1회";
    default:
      return "보상";
  }
}

export function rewardModalBodyKo(kind: AttendanceRewardKind, couponPending: boolean): string {
  if (kind === "coupon_5pct" && couponPending) {
    return "기존 쿠폰을 먼저 사용하면 자동으로 발급돼요.";
  }
  switch (kind) {
    case "voice_5min":
      return "음성 상담 시간에 5분이 더해졌어요.";
    case "coupon_5pct":
      return "구매 시 적용할 수 있는 할인 쿠폰이 발급됐어요.";
    case "dream_once":
      return "구매 화면에서 사용할 수 있는 꿈해몽 무료 풀이 1회권이 생겼어요. 발급일로부터 30일 동안 유효해요.";
    default:
      return "";
  }
}

export function nextCycleRewardPreviewKo(nextCycle: number): string {
  return cycleRewardLineKo(nextCycle);
}
