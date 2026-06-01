import type { FortuneBirthPayload } from "@/lib/fortune-ux/sajuStorage";

/** 보관함 중복 판별용 — 본인 생년월일시만(궁합 상대 제외). */
export function buildSajuFingerprint(input: FortuneBirthPayload): string {
  const calendar =
    input.calendarType === "lunar-leap" ? "lunar-leap" : input.calendarType === "lunar" ? "lunar" : "solar";
  const hour = input.hour.trim();
  const minute = input.minute.trim() || "00";
  const timeUnknown = !hour ? "1" : "0";
  return [
    calendar,
    input.year.trim(),
    input.month.trim().padStart(2, "0"),
    input.day.trim().padStart(2, "0"),
    timeUnknown,
    timeUnknown === "1" ? "" : hour.padStart(2, "0"),
    timeUnknown === "1" ? "" : minute.padStart(2, "0"),
    input.gender === "female" ? "f" : "m",
  ].join("|");
}

/** 점사 prefetch·스트림 캐시 무효화 — 생년월일시 + 이름 */
export function buildFortunePrefetchContextKey(input: FortuneBirthPayload): string {
  const name = String(input.name ?? "").trim();
  return `${buildSajuFingerprint(input)}|n:${name}`;
}
