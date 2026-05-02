import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  attendanceVoiceRewardSeconds,
  cycleRewardLineKo,
  rewardKindForCycle,
  type AttendanceRewardKind,
} from "@/lib/attendance-rewards";
import { badgeStreak, computeStampDisplay } from "@/lib/attendance-sync-core";
import { addKstCalendarDays, formatKstDateKey } from "@/lib/datetime/kst";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

type AttendanceStateRow = {
  streak: number;
  cycle: number;
  last_attendance_kst_date: string | null;
  coupon_pending: boolean;
};

async function fetchState(supabase: SupabaseClient, userId: string): Promise<AttendanceStateRow> {
  const { data, error } = await supabase
    .from("user_attendance_state")
    .select("streak, cycle, last_attendance_kst_date, coupon_pending")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return { streak: 0, cycle: 1, last_attendance_kst_date: null, coupon_pending: false };
  }
  return {
    streak: Number(data.streak ?? 0),
    cycle: Math.max(1, Number(data.cycle ?? 1)),
    last_attendance_kst_date: data.last_attendance_kst_date ?? null,
    coupon_pending: Boolean(data.coupon_pending),
  };
}

async function expireStaleCoupons(supabase: SupabaseClient, userId: string, nowIso: string) {
  await supabase
    .from("user_discount_coupons")
    .update({ consumed_at: nowIso })
    .eq("user_id", userId)
    .is("consumed_at", null)
    .lt("expires_at", nowIso);
}

async function hasActiveCoupon(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("user_discount_coupons")
    .select("id")
    .eq("user_id", userId)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();
  return Boolean(data);
}

async function tryGrantPendingCoupon(
  supabase: SupabaseClient,
  userId: string,
  now: Date,
): Promise<{ granted: boolean; pendingFlag: boolean }> {
  const nowIso = now.toISOString();
  await expireStaleCoupons(supabase, userId, nowIso);

  const state = await fetchState(supabase, userId);
  if (!state.coupon_pending) return { granted: false, pendingFlag: false };

  const active = await hasActiveCoupon(supabase, userId);
  if (active) return { granted: false, pendingFlag: true };

  const expires = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const { error } = await supabase.from("user_discount_coupons").insert({
    user_id: userId,
    discount_pct: 5,
    source: "attendance_pending",
    expires_at: expires,
  });
  if (error?.code === "23505") {
    return { granted: false, pendingFlag: true };
  }
  if (error) throw error;

  await supabase
    .from("user_attendance_state")
    .update({ coupon_pending: false, updated_at: nowIso })
    .eq("user_id", userId);

  return { granted: true, pendingFlag: false };
}

async function grantCouponOrPending(
  supabase: SupabaseClient,
  userId: string,
  now: Date,
): Promise<"granted" | "pending"> {
  const nowIso = now.toISOString();
  await expireStaleCoupons(supabase, userId, nowIso);

  const active = await hasActiveCoupon(supabase, userId);
  if (active) {
    await supabase
      .from("user_attendance_state")
      .update({ coupon_pending: true, updated_at: nowIso })
      .eq("user_id", userId);
    return "pending";
  }

  const expires = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const { error } = await supabase.from("user_discount_coupons").insert({
    user_id: userId,
    discount_pct: 5,
    source: "attendance",
    expires_at: expires,
  });
  if (error?.code === "23505") {
    await supabase
      .from("user_attendance_state")
      .update({ coupon_pending: true, updated_at: nowIso })
      .eq("user_id", userId);
    return "pending";
  }
  if (error) throw error;
  return "granted";
}

async function grantDreamPass(supabase: SupabaseClient, userId: string, now: Date) {
  const expires = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const { error } = await supabase.from("user_dream_interpretation_passes").insert({
    user_id: userId,
    quantity: 1,
    expires_at: expires,
    source: "attendance",
  });
  if (error) throw error;
}

function buildJsonPayload(input: {
  todayKst: string;
  yesterdayKst: string;
  state: AttendanceStateRow;
  attendedToday: boolean;
  completedSeven: boolean;
  rewardKind: AttendanceRewardKind | null;
  couponPendingFromReward: boolean;
  voiceSeconds: number;
  pendingCouponGranted: boolean;
  couponPending: boolean;
}) {
  const {
    todayKst,
    yesterdayKst,
    state,
    attendedToday,
    completedSeven,
    rewardKind,
    couponPendingFromReward,
    voiceSeconds,
    pendingCouponGranted,
    couponPending,
  } = input;

  const stamp = computeStampDisplay({
    todayKst,
    yesterdayKst,
    lastKst: state.last_attendance_kst_date,
    streakDb: state.streak,
    attendedToday,
  });

  const badge = badgeStreak({
    lastKst: state.last_attendance_kst_date,
    yesterdayKst,
    streakDb: state.streak,
    attendedToday,
  });

  const daysUntilSeven = Math.max(0, 7 - badge);

  return {
    ok: true as const,
    todayKst,
    attendedToday,
    streak: state.streak,
    cycle: state.cycle,
    badgeStreak: badge,
    daysUntilSeven,
    stampFilled: stamp.filled,
    stampPulseIndex: stamp.pulseIndex,
    cycleRewardLine: cycleRewardLineKo(state.cycle),
    completedSeven,
    rewardKind,
    couponPendingFromReward,
    voiceSecondsAdded: voiceSeconds,
    pendingCouponGranted,
    couponPending,
    nextCyclePreviewLine: cycleRewardLineKo(state.cycle),
  };
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceKey = env.supabaseServiceRoleKey;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  const supabase = createClient(env.supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });
  }

  const userId = userData.user.id;
  const now = new Date();
  const todayKst = formatKstDateKey(now);
  const yesterdayKst = addKstCalendarDays(todayKst, -1);
  const nowIso = now.toISOString();

  const { data: existingAttendance, error: exErr } = await supabase
    .from("daily_attendance")
    .select("kst_date")
    .eq("user_id", userId)
    .eq("kst_date", todayKst)
    .maybeSingle();

  if (exErr) {
    console.warn("[attendance/sync]", exErr.message);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }

  if (existingAttendance?.kst_date) {
    let pendingGranted = false;
    try {
      const r = await tryGrantPendingCoupon(supabase, userId, now);
      pendingGranted = r.granted;
    } catch (e) {
      console.warn("[attendance/sync] pending coupon", e);
    }

    const state = await fetchState(supabase, userId);
    try {
      await expireStaleCoupons(supabase, userId, nowIso);
    } catch {
      /* ignore */
    }

    return NextResponse.json(
      buildJsonPayload({
        todayKst,
        yesterdayKst,
        state,
        attendedToday: true,
        completedSeven: false,
        rewardKind: null,
        couponPendingFromReward: false,
        voiceSeconds: 0,
        pendingCouponGranted: pendingGranted,
        couponPending: state.coupon_pending,
      }),
    );
  }

  const stateBefore = await fetchState(supabase, userId);

  let newStreak: number;
  if (stateBefore.last_attendance_kst_date === yesterdayKst) {
    newStreak = stateBefore.streak + 1;
  } else {
    newStreak = 1;
  }

  const { error: insErr } = await supabase.from("daily_attendance").insert({
    user_id: userId,
    kst_date: todayKst,
  });

  if (insErr?.code === "23505") {
    const state2 = await fetchState(supabase, userId);
    let pendingGranted = false;
    try {
      const r = await tryGrantPendingCoupon(supabase, userId, now);
      pendingGranted = r.granted;
    } catch {
      /* ignore */
    }
    return NextResponse.json(
      buildJsonPayload({
        todayKst,
        yesterdayKst,
        state: state2,
        attendedToday: true,
        completedSeven: false,
        rewardKind: null,
        couponPendingFromReward: false,
        voiceSeconds: 0,
        pendingCouponGranted: pendingGranted,
        couponPending: state2.coupon_pending,
      }),
    );
  }

  if (insErr) {
    console.warn("[attendance/sync] insert", insErr.message);
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }

  let cycle = stateBefore.cycle;
  let couponPending = stateBefore.coupon_pending;
  let completedSeven = false;
  let rewardKind: AttendanceRewardKind | null = null;
  let couponPendingFromReward = false;
  let voiceSeconds = 0;

  if (newStreak === 7) {
    completedSeven = true;
    rewardKind = rewardKindForCycle(cycle);

    if (rewardKind === "voice_5min") {
      voiceSeconds = attendanceVoiceRewardSeconds();
    } else if (rewardKind === "coupon_5pct") {
      const g = await grantCouponOrPending(supabase, userId, now);
      couponPendingFromReward = g === "pending";
      const st = await fetchState(supabase, userId);
      couponPending = st.coupon_pending;
    } else {
      await grantDreamPass(supabase, userId, now);
    }

    newStreak = 1;
    cycle = cycle + 1;
  }

  const { error: upErr } = await supabase.from("user_attendance_state").upsert(
    {
      user_id: userId,
      streak: newStreak,
      cycle,
      last_attendance_kst_date: todayKst,
      coupon_pending: couponPending,
      updated_at: nowIso,
    },
    { onConflict: "user_id" },
  );

  if (upErr) {
    console.warn("[attendance/sync] upsert state", upErr.message);
    return NextResponse.json({ ok: false, error: "state_failed" }, { status: 500 });
  }

  let pendingGranted = false;
  try {
    const r = await tryGrantPendingCoupon(supabase, userId, now);
    pendingGranted = r.granted;
  } catch (e) {
    console.warn("[attendance/sync] pending after checkin", e);
  }

  const finalState = await fetchState(supabase, userId);

  return NextResponse.json(
    buildJsonPayload({
      todayKst,
      yesterdayKst,
      state: finalState,
      attendedToday: true,
      completedSeven,
      rewardKind,
      couponPendingFromReward,
      voiceSeconds,
      pendingCouponGranted: pendingGranted,
      couponPending: finalState.coupon_pending,
    }),
  );
}
