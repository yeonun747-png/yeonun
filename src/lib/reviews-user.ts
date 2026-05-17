export type ReviewSourceType = "fortune" | "voice" | "chat";

export type UserReviewRecord = {
  id: string;
  sourceType: ReviewSourceType;
  sourceId: string;
  stars: number;
  body: string;
  tags: string[];
  characterKey: "yeon" | "yeo" | "un" | "byeol";
  productLine: string;
  title: string;
  submittedAt: string;
  isPublished: boolean;
};

export function buildReviewUserMask(
  displayName: string | null | undefined,
  opts?: { birthYear?: number | null; gender?: string | null },
): string {
  const raw = (displayName ?? "").trim() || "회원";
  const masked = raw.length > 1 ? `${raw[0]}**` : `${raw}*`;
  const age =
    typeof opts?.birthYear === "number" && opts.birthYear > 1900
      ? new Date().getFullYear() - opts.birthYear + 1
      : null;
  const gender =
    opts?.gender === "female" ? "여" : opts?.gender === "male" ? "남" : null;
  if (age && gender) return `${masked} (${age}세, ${gender})`;
  if (age) return `${masked} (${age}세)`;
  if (gender) return `${masked} (${gender})`;
  return masked;
}

export const REVIEW_TAG_OPTIONS = [
  "#도움됐어요",
  "#정확해요",
  "#또올게요",
  "#이해하기쉬웠어요",
  "#아쉬웠어요",
  "#기대와달랐어요",
] as const;

const STAR_HINTS = [
  "",
  "어떤 점이 아쉬우셨나요?",
  "아쉬운 점을 알려주세요",
  "좋고 아쉬운 점을 알려주세요",
  "어떤 점이 좋으셨나요?",
  "무엇이 가장 좋으셨나요?",
] as const;

export function reviewStarHint(stars: number): string {
  if (stars < 1 || stars > 5) return "별을 탭해서 평가해 주세요";
  return STAR_HINTS[stars];
}

export function reviewQuestion(kind: ReviewSourceType): string {
  if (kind === "voice" || kind === "chat") return "상담 어떠셨나요?";
  return "이 풀이 어떠셨나요?";
}

export const USER_REVIEWS_CHANGED_EVENT = "yeonun:user-reviews-changed";

export function showYeonunToast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("yeonun:toast", { detail: { message } }));
}
