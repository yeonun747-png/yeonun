import type { CalendarType } from "@/lib/manse-ryeok";
import { PARTNER_HOUR_BRANCH_TO_CLOCK_HOUR } from "@/lib/partner-hour-branch";
import { TIME_TAB_BRANCH_KEYS, type BirthBranchKey } from "@/lib/profile-branch-from-time-tab";
import type { ProfileApiRow } from "@/lib/profile-sync-from-api";

const SAJU_LS_KEY = "yeonun_saju_v1";

type LocalSaju = {
  name?: string;
  calendarType?: string;
  year?: string;
  month?: string;
  day?: string;
  hour?: string;
  minute?: string;
  gender?: string;
};

function readLocalSaju(): LocalSaju | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SAJU_LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalSaju;
  } catch {
    return null;
  }
}

function clockHourToBranchKey(hour: number): BirthBranchKey | null {
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  for (const key of TIME_TAB_BRANCH_KEYS) {
    const start = PARTNER_HOUR_BRANCH_TO_CLOCK_HOUR[key];
    if (start === 23) {
      if (hour >= 23 || hour < 1) return key;
      continue;
    }
    if (hour >= start && hour < start + 2) return key;
  }
  return null;
}

function profileHasBirth(row: ProfileApiRow | null): boolean {
  if (!row) return false;
  return row.birth_year != null && row.birth_month != null && row.birth_day != null;
}

/** localStorage yeonun_saju_v1 → POST /api/me/profile body */
export function localSajuToProfileBody(local: LocalSaju): Record<string, unknown> | null {
  const y = parseInt(String(local.year ?? ""), 10);
  const mo = parseInt(String(local.month ?? ""), 10);
  const d = parseInt(String(local.day ?? ""), 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;

  const ctRaw = String(local.calendarType ?? "solar");
  const calendar_type: CalendarType =
    ctRaw === "lunar-leap" ? "lunar-leap" : ctRaw === "lunar" ? "lunar" : "solar";

  const hRaw = local.hour != null ? String(local.hour).trim() : "";
  const hNum = hRaw !== "" ? parseInt(hRaw, 10) : NaN;
  const birth_time_unknown = !(Number.isFinite(hNum) && hNum >= 0 && hNum <= 23);
  const birth_branch_key = birth_time_unknown ? null : clockHourToBranchKey(hNum);

  return {
    display_name: String(local.name ?? "").trim() || "회원",
    birth_year: y,
    birth_month: mo,
    birth_day: d,
    calendar_type,
    birth_branch_key,
    birth_time_unknown,
    gender: local.gender === "male" ? "male" : "female",
    complete_onboarding: true,
  };
}

/** 마이탭·점사 등에서 저장한 local 사주 → 서버 profiles (어드민 CS 표시용) */
export async function pushLocalSajuToServerProfile(accessToken: string): Promise<boolean> {
  const local = readLocalSaju();
  if (!local) return false;

  const body = localSajuToProfileBody(local);
  if (!body) return false;

  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  const existingRes = await fetch("/api/me/profile", { headers, cache: "no-store" });
  if (existingRes.ok) {
    const existing = (await existingRes.json()) as ProfileApiRow;
    if (profileHasBirth(existing)) return false;
  }

  const res = await fetch("/api/me/profile", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return res.ok;
}

/** 로그인 후: 서버에 사주 없고 local만 있으면 1회 업로드 */
export async function syncLocalSajuToServerIfNeeded(accessToken: string): Promise<void> {
  await pushLocalSajuToServerProfile(accessToken);
}
