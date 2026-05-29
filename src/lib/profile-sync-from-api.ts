"use client";

import type { CalendarType } from "@/lib/manse-ryeok";
import { readStoredSaju, persistYeonunSajuV1 } from "@/lib/fortune-ux/sajuStorage";
import { YEONUN_SAJU_UPDATED_EVENT } from "@/lib/saju-events";
import { PARTNER_HOUR_BRANCH_TO_CLOCK_HOUR } from "@/lib/partner-hour-branch";

export type ProfileApiRow = {
  display_name?: string;
  birth_year?: number | null;
  birth_month?: number | null;
  birth_day?: number | null;
  calendar_type?: string | null;
  birth_branch_key?: string | null;
  birth_minute?: number | null;
  birth_time_unknown?: boolean | null;
  gender?: string | null;
  onboarding_completed_at?: string | null;
};

function normalizeMinute(raw: unknown): string {
  const miNum = parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(miNum) || miNum < 0 || miNum > 59) return "0";
  return String(miNum);
}

/** 서버 profiles → 로컬 yeonun_saju_v1 (점사·오늘 탭 공통) */
export function applyProfileRowToLocalStorage(row: ProfileApiRow | null): void {
  if (!row?.onboarding_completed_at) return;
  const y = row.birth_year != null ? String(row.birth_year) : "";
  const mo = row.birth_month != null ? String(row.birth_month) : "";
  const d = row.birth_day != null ? String(row.birth_day) : "";
  if (!y || !mo || !d) return;

  const calendarType: CalendarType =
    row.calendar_type === "lunar-leap" ? "lunar-leap" : row.calendar_type === "lunar" ? "lunar" : "solar";

  let hour = "";
  let minute = "0";
  if (!row.birth_time_unknown && row.birth_branch_key) {
    const h = PARTNER_HOUR_BRANCH_TO_CLOCK_HOUR[row.birth_branch_key];
    if (typeof h === "number") {
      hour = String(h);
      if (row.birth_minute != null) {
        minute = normalizeMinute(row.birth_minute);
      } else {
        const local = readStoredSaju();
        const sameBirth =
          local &&
          local.year === y &&
          local.month === mo &&
          local.day === d &&
          local.calendarType === calendarType &&
          local.hour === hour;
        minute = sameBirth && local.minute.trim() !== "" ? normalizeMinute(local.minute) : "0";
      }
    }
  }

  persistYeonunSajuV1({
    name: String(row.display_name ?? "").trim(),
    calendarType,
    year: y,
    month: mo,
    day: d,
    hour,
    minute,
    gender: row.gender === "male" ? "male" : "female",
  });

  try {
    window.dispatchEvent(new Event(YEONUN_SAJU_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

export async function syncProfileFromServer(accessToken: string): Promise<void> {
  const res = await fetch("/api/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return;
  const row = (await res.json()) as ProfileApiRow;
  applyProfileRowToLocalStorage(row);
}
