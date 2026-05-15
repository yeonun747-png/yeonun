"use client";

import type { CalendarType } from "@/lib/manse-ryeok";
import { YEONUN_SAJU_UPDATED_EVENT } from "@/lib/saju-events";
import { persistYeonunSajuV1 } from "@/lib/fortune-ux/sajuStorage";
import { PARTNER_HOUR_BRANCH_TO_CLOCK_HOUR } from "@/lib/partner-hour-branch";

export type ProfileApiRow = {
  display_name?: string;
  birth_year?: number | null;
  birth_month?: number | null;
  birth_day?: number | null;
  calendar_type?: string | null;
  birth_branch_key?: string | null;
  birth_time_unknown?: boolean | null;
  gender?: string | null;
  onboarding_completed_at?: string | null;
};

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
  let minute = "";
  if (!row.birth_time_unknown && row.birth_branch_key) {
    const h = PARTNER_HOUR_BRANCH_TO_CLOCK_HOUR[row.birth_branch_key];
    if (typeof h === "number") {
      hour = String(h);
      minute = "0";
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
