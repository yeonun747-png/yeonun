import { NextResponse } from "next/server";

import type { CalendarType } from "@/lib/manse-ryeok";
import { TIME_TAB_BRANCH_KEYS, type BirthBranchKey } from "@/lib/profile-branch-from-time-tab";
import { bearerFromRequest, supabaseRouteUserClient } from "@/lib/supabase/route-user-client";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function assertNotWithdrawn(authUserId: string): Promise<boolean> {
  try {
    const sb = supabaseServer();
    const { count, error } = await sb
      .from("yeonun_social_users")
      .select("*", { count: "exact", head: true })
      .eq("auth_user_id", authUserId)
      .is("deleted_at", null);
    if (error) return true;
    return typeof count === "number" && count > 0;
  } catch {
    return true;
  }
}

function parseBirthBranchKey(raw: unknown): BirthBranchKey | null {
  if (raw == null || raw === "") return null;
  const s = String(raw);
  return (TIME_TAB_BRANCH_KEYS as readonly string[]).includes(s) ? (s as BirthBranchKey) : null;
}

type ProfileBody = {
  display_name?: string;
  birth_year?: number;
  birth_month?: number;
  birth_day?: number;
  calendar_type?: CalendarType;
  birth_branch_key?: BirthBranchKey | null;
  birth_time_unknown?: boolean;
  gender?: "male" | "female";
  complete_onboarding?: boolean;
};

export async function GET(request: Request) {
  const token = bearerFromRequest(request);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseRouteUserClient(token);
  if (!sb) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  const uid = userData.user.id;
  const okSocial = await assertNotWithdrawn(uid);
  if (!okSocial) return NextResponse.json({ error: "account_withdrawn" }, { status: 403 });

  const { data: row, error } = await sb.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(row ?? null);
}

export async function POST(request: Request) {
  const token = bearerFromRequest(request);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseRouteUserClient(token);
  if (!sb) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  const uid = userData.user.id;
  const okSocial = await assertNotWithdrawn(uid);
  if (!okSocial) return NextResponse.json({ error: "account_withdrawn" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as ProfileBody;

  const display_name = String(body.display_name ?? "").trim();
  const calendar_type =
    body.calendar_type === "lunar-leap" ? "lunar-leap" : body.calendar_type === "lunar" ? "lunar" : "solar";

  const gender = body.gender === "male" ? "male" : "female";
  const birth_time_unknown = Boolean(body.birth_time_unknown);
  const branch = birth_time_unknown ? null : parseBirthBranchKey(body.birth_branch_key);

  const patch = {
    id: uid,
    display_name,
    birth_year: body.birth_year ?? null,
    birth_month: body.birth_month ?? null,
    birth_day: body.birth_day ?? null,
    calendar_type,
    birth_branch_key: branch,
    birth_time_unknown,
    gender,
    ...(body.complete_onboarding ? { onboarding_completed_at: new Date().toISOString() } : {}),
  };

  const { data: row, error } = await sb.from("profiles").upsert(patch, { onConflict: "id" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(row);
}
