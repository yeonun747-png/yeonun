import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { addKstCalendarDays, formatKstDateKey } from "@/lib/datetime/kst";
import { env } from "@/lib/env";
import { requireMyUserId } from "@/lib/my-route-auth";

export const dynamic = "force-dynamic";

/** M08 미션 — 배정일 기준 7일 내 친구 가입 성공 여부 */
export async function GET(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const assigned = url.searchParams.get("assigned_kst")?.trim() ?? formatKstDateKey(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(assigned)) {
    return NextResponse.json({ ok: false, error: "invalid_date" }, { status: 400 });
  }

  const serviceKey = env.supabaseServiceRoleKey;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  const supabase = createClient(env.supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const deadline = addKstCalendarDays(assigned, 7);
  const { data } = await supabase
    .from("referral_signups")
    .select("id,created_at")
    .eq("referrer_user_id", auth.userId)
    .eq("assigned_kst_date", assigned)
    .limit(1)
    .maybeSingle();

  const today = formatKstDateKey(new Date());
  const inWindow = today <= deadline;

  return NextResponse.json({
    ok: true,
    completed: Boolean(data?.id),
    in_window: inWindow,
    assigned_kst: assigned,
  });
}
