import { NextResponse } from "next/server";

import { getKstParts } from "@/lib/datetime/kst";
import { supabaseServer } from "@/lib/supabase/server";

export type AgeGateResult =
  | { ok: true }
  | { ok: false; error: "age_verification_required" | "underage_not_allowed" };

function computeAgeYearsKst(
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  now: Date = new Date(),
): number {
  const { year, month, day } = getKstParts(now);
  let age = year - birthYear;
  const beforeBirthday = month < birthMonth || (month === birthMonth && day < birthDay);
  if (beforeBirthday) age -= 1;
  return age;
}

export function validateAge14PlusFromBirth(
  birthYear: number | null | undefined,
  birthMonth: number | null | undefined,
  birthDay: number | null | undefined,
): AgeGateResult {
  const y = typeof birthYear === "number" ? birthYear : null;
  const m = typeof birthMonth === "number" ? birthMonth : null;
  const d = typeof birthDay === "number" ? birthDay : null;
  if (!y || !m || !d) return { ok: false, error: "age_verification_required" };
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return { ok: false, error: "age_verification_required" };
  const age = computeAgeYearsKst(y, m, d);
  if (age < 14) return { ok: false, error: "underage_not_allowed" };
  return { ok: true };
}

/** 메인 이용자(계정 소유자) 만 14세 이상 강제 */
export async function assertUserAge14Plus(
  userId: string,
): Promise<AgeGateResult> {
  const uid = String(userId ?? "").trim();
  if (!uid) return { ok: false, error: "age_verification_required" };

  let sb;
  try {
    sb = supabaseServer();
  } catch {
    // 서버 misconfigured는 다른 경로에서 503 처리; 여기서는 차단으로 반환
    return { ok: false, error: "age_verification_required" };
  }

  const { data } = await sb
    .from("profiles")
    .select("birth_year,birth_month,birth_day")
    .eq("id", uid)
    .maybeSingle();

  const row = (data ?? {}) as { birth_year?: number | null; birth_month?: number | null; birth_day?: number | null };
  return validateAge14PlusFromBirth(row.birth_year, row.birth_month, row.birth_day);
}

export function ageGateToNextResponse(r: AgeGateResult): NextResponse | null {
  if (r.ok) return null;
  const status = r.error === "underage_not_allowed" ? 403 : 428;
  return NextResponse.json({ error: r.error }, { status });
}

