import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { MISSIONS, type MissionId } from "@/lib/daily-missions";
import {
  grantMissionCouponReward,
  grantMissionCreditsIfNew,
  missionGrantKey,
} from "@/lib/mission-coupon-server";
import { env } from "@/lib/env";
import { requireMyUserId } from "@/lib/my-route-auth";

export const dynamic = "force-dynamic";

const COUPON_MISSIONS = new Set<MissionId>(["M01", "M05", "M09"]);

export async function POST(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    mission_id?: MissionId;
    grant_key?: string;
    cadence?: "once" | "daily" | "hours24" | "unlimited";
  };

  const missionId = body.mission_id;
  if (!missionId || !MISSIONS[missionId]) {
    return NextResponse.json({ ok: false, error: "invalid_mission" }, { status: 400 });
  }

  const serviceKey = env.supabaseServiceRoleKey;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  const supabase = createClient(env.supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const def = MISSIONS[missionId];
  const grantKey = body.grant_key?.trim() || missionGrantKey(missionId, body.cadence ?? def.cadence);
  const now = new Date();

  try {
    let creditsGranted = 0;
    let creditsDuplicate = false;
    if (!COUPON_MISSIONS.has(missionId)) {
      const r = await grantMissionCreditsIfNew(supabase, auth.userId, missionId, grantKey);
      creditsGranted = r.granted;
      creditsDuplicate = r.duplicate;
    }

    let coupon: { granted: boolean; pending: boolean; kind: string } | null = null;
    if (COUPON_MISSIONS.has(missionId)) {
      const { data: existing } = await supabase
        .from("user_mission_reward_grants")
        .select("id")
        .eq("user_id", auth.userId)
        .eq("grant_key", grantKey)
        .maybeSingle();
      if (!existing?.id) {
        coupon = await grantMissionCouponReward(supabase, auth.userId, missionId, now);
        await supabase.from("user_mission_reward_grants").insert({
          user_id: auth.userId,
          grant_key: grantKey,
          mission_id: missionId,
          reward_kind: coupon.kind === "dream" ? "dream_pass" : "discount_coupon",
        });
      } else {
        coupon = { granted: false, pending: false, kind: "duplicate" };
      }
    }

    return NextResponse.json({
      ok: true,
      mission_id: missionId,
      credits_granted: creditsGranted,
      credits_duplicate: creditsDuplicate,
      coupon,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "reward_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
