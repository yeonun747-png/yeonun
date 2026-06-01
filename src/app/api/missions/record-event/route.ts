import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { normalizeMissionEventKey, recordUserMissionEvent } from "@/lib/mission-event-server";
import { requireMyUserId } from "@/lib/my-route-auth";
import { checkRateLimitAsync } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  if (!(await checkRateLimitAsync(`mission-event:${auth.userId}`, 60, 60 * 60 * 1000))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    event_key?: string;
    kst_date?: string;
  };

  const eventKey = normalizeMissionEventKey(String(body.event_key ?? ""));
  const kstDate = String(body.kst_date ?? "").trim();
  if (!eventKey || !/^\d{4}-\d{2}-\d{2}$/.test(kstDate)) {
    return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
  }

  const serviceKey = env.supabaseServiceRoleKey;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  const supabase = createClient(env.supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await recordUserMissionEvent(supabase, auth.userId, eventKey, kstDate);
  return NextResponse.json({ ok: true });
}
