import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { MISSIONS, type MissionId } from "@/lib/daily-missions";
import {
  grantMissionCouponReward,
  grantMissionCreditsIfNew,
  missionGrantKey,
} from "@/lib/mission-coupon-server";
import { assertMissionEligibleOnServer } from "@/lib/mission-server-verify";
import { env } from "@/lib/env";
import { requireMyUserId } from "@/lib/my-route-auth";

export const dynamic = "force-dynamic";

const COUPON_MISSIONS = new Set<MissionId>(["M01", "M05", "M09"]);

/** M08 친구 초대 — referral-server에서만 크레딧 지급 */
const SERVER_ONLY_CREDIT_MISSIONS = new Set<MissionId>(["M08"]);

export async function POST(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    mission_id?: MissionId;
  };

  const missionId = body.mission_id;
  if (!missionId || !MISSIONS[missionId]) {
    return NextResponse.json({ ok: false, error: "invalid_mission" }, { status: 400 });
  }

  if (SERVER_ONLY_CREDIT_MISSIONS.has(missionId)) {
    return NextResponse.json({ ok: false, error: "mission_reward_not_available" }, { status: 403 });
  }

  const serviceKey = env.supabaseServiceRoleKey;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  const supabase = createClient(env.supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const def = MISSIONS[missionId];
  const grantKey = missionGrantKey(missionId, def.cadence);
  const now = new Date();

  const eligible = await assertMissionEligibleOnServer(supabase, auth.userId, missionId);
  if (!eligible.ok) {
    return NextResponse.json({ ok: false, error: eligible.error }, { status: 403 });
  }

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
