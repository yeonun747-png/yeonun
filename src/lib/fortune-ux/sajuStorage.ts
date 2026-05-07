"use client";

import type { CalendarType } from "@/lib/manse-ryeok";

/** `fortune-manse-context`·FortuneStream 본문과 동일한 키 — localStorage + sessionStorage 동시 기록 */
export const YEONUN_SAJU_LS_KEY = "yeonun_saju_v1";

export type FortuneBirthPayload = {
  name: string;
  calendarType: CalendarType;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  gender: "male" | "female";
};

export function persistYeonunSajuV1(payload: FortuneBirthPayload) {
  const raw = JSON.stringify(payload);
  try {
    localStorage.setItem(YEONUN_SAJU_LS_KEY, raw);
  } catch {
    // ignore
  }
  try {
    sessionStorage.setItem(YEONUN_SAJU_LS_KEY, raw);
  } catch {
    // ignore
  }
}

export function readStoredSaju(): FortuneBirthPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(YEONUN_SAJU_LS_KEY) ?? sessionStorage.getItem(YEONUN_SAJU_LS_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Record<string, unknown>;
    const calendarType =
      j.calendarType === "lunar-leap" ? "lunar-leap" : j.calendarType === "lunar" ? "lunar" : "solar";
    const y = String(j.year ?? "").trim();
    const mo = String(j.month ?? "").trim();
    const d = String(j.day ?? "").trim();
    if (!y || !mo || !d) return null;
    return {
      name: String(j.name ?? "").trim(),
      calendarType,
      year: y,
      month: mo,
      day: d,
      hour: j.hour != null ? String(j.hour).trim() : "",
      minute: j.minute != null ? String(j.minute).trim() : "",
      gender: j.gender === "female" ? "female" : "male",
    };
  } catch {
    return null;
  }
}
