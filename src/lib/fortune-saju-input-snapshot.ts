import { computeManseFromFormInput, type CalendarType } from "@/lib/manse-ryeok";
import type { FortuneBirthPayload } from "@/lib/fortune-ux/sajuStorage";

/** fortune_requests.payload.saju_input — 점사 당시 본인 생년월일시 */
export function parseFortuneSajuInputSnapshot(raw: unknown): FortuneBirthPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const j = raw as Record<string, unknown>;
  const calendarType: CalendarType =
    j.calendarType === "lunar-leap" ? "lunar-leap" : j.calendarType === "lunar" ? "lunar" : "solar";
  const year = String(j.year ?? "").trim();
  const month = String(j.month ?? "").trim();
  const day = String(j.day ?? "").trim();
  if (!year || !month || !day) return null;

  const payload: FortuneBirthPayload = {
    name: String(j.name ?? "").trim(),
    calendarType,
    year,
    month,
    day,
    hour: j.hour != null ? String(j.hour).trim() : "",
    minute: j.minute != null ? String(j.minute).trim() : "",
    gender: j.gender === "female" ? "female" : "male",
  };

  const computed = computeManseFromFormInput({
    userYear: payload.year,
    userMonth: payload.month,
    userDay: payload.day,
    userBirthHour: payload.hour || null,
    userBirthMinute: payload.minute || null,
    userCalendarType: payload.calendarType,
    userName: payload.name,
  });
  return computed ? payload : null;
}

/** 보관함 저장 API body → payload.saju_input */
export function normalizeFortuneSajuInputForSave(raw: unknown): FortuneBirthPayload | null {
  return parseFortuneSajuInputSnapshot(raw);
}
