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

/** 서버 Tank — `client_body.user_info`만으로 context key (달력은 양력 기본) */
export function buildFortunePrefetchContextKeyFromStreamUserInfo(
  userInfo?: { name?: string; gender?: string; birth_date?: string; birth_hour?: string } | null,
): string | null {
  if (!userInfo || typeof userInfo !== "object") return null;
  const birthDate = String(userInfo.birth_date ?? "").trim();
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(birthDate);
  if (!m) return null;

  let hour = "";
  let minute = "00";
  const birthHour = String(userInfo.birth_hour ?? "").trim();
  if (birthHour) {
    const hm = /^(\d{1,2})(?::(\d{1,2}))?$/.exec(birthHour);
    if (hm) {
      hour = hm[1].padStart(2, "0");
      minute = (hm[2] ?? "00").padStart(2, "0");
    }
  }

  const genderRaw = String(userInfo.gender ?? "").trim();
  const gender: FortuneBirthPayload["gender"] =
    genderRaw === "여" || genderRaw === "female" || genderRaw === "f" ? "female" : "male";

  return buildFortunePrefetchContextKey({
    name: String(userInfo.name ?? "").trim(),
    calendarType: "solar",
    year: m[1],
    month: m[2],
    day: m[3],
    hour,
    minute,
    gender,
  });
}
