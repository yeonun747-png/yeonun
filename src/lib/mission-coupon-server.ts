import type { SupabaseClient } from "@supabase/supabase-js";

import { formatKstDateKey } from "@/lib/datetime/kst";
import type { MissionId } from "@/lib/daily-missions";
import { missionRewardCredits, VOICE_MINUTE_CREDITS } from "@/lib/daily-missions";
import { adminAdjustCredits } from "@/lib/credit-server";

export type DiscountCouponRow = {
  id: string;
  user_id: string;
  discount_pct: number;
  discount_fixed_krw: number | null;
  source: string;
  expires_at: string;
  consumed_at: string | null;
};

export type DreamPassRow = {
  id: string;
  user_id: string;
  quantity: number;
  expires_at: string;
  source: string;
};

export type UserCouponView =
  | {
      kind: "percent";
      id: string;
      label: string;
      discount_pct: number;
      expires_at: string;
      source: string;
    }
  | {
      kind: "fixed";
      id: string;
      label: string;
      discount_fixed_krw: number;
      expires_at: string;
      source: string;
    }
  | {
      kind: "dream_free";
      id: string;
      label: string;
      quantity: number;
      expires_at: string;
      source: string;
    };

export type CheckoutCouponApply = {
  final_price_krw: number;
  discount_krw: number;
  label: string;
  consume_discount_coupon_id: string | null;
  consume_dream_pass_id: string | null;
};

const COUPON_MISSION_IDS = new Set<MissionId>(["M01", "M05", "M09"]);
const COUPON_TTL_MS = 30 * 86_400_000;

function couponLabel(row: DiscountCouponRow): string {
  if (row.discount_fixed_krw && row.discount_fixed_krw > 0) {
    return `풀이 ${row.discount_fixed_krw.toLocaleString("ko-KR")}원 할인`;
  }
  return `콘텐츠 ${row.discount_pct}% 할인`;
}

function dreamPassLabel(row: DreamPassRow): string {
  return `꿈해몽 무료 ${row.quantity}회`;
}

export async function expireStaleCoupons(supabase: SupabaseClient, userId: string, nowIso: string) {
  await supabase
    .from("user_discount_coupons")
    .update({ consumed_at: nowIso })
    .eq("user_id", userId)
    .is("consumed_at", null)
    .lt("expires_at", nowIso);
}

export async function getActiveDiscountCoupon(
  supabase: SupabaseClient,
  userId: string,
): Promise<DiscountCouponRow | null> {
  const nowIso = new Date().toISOString();
  await expireStaleCoupons(supabase, userId, nowIso);
  const { data } = await supabase
    .from("user_discount_coupons")
    .select("id,user_id,discount_pct,discount_fixed_krw,source,expires_at,consumed_at")
    .eq("user_id", userId)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as DiscountCouponRow | null) ?? null;
}

export async function getActiveDreamPass(
  supabase: SupabaseClient,
  userId: string,
): Promise<DreamPassRow | null> {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("user_dream_interpretation_passes")
    .select("id,user_id,quantity,expires_at,source")
    .eq("user_id", userId)
    .gt("expires_at", nowIso)
    .gt("quantity", 0)
    .order("expires_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as DreamPassRow | null) ?? null;
}

export async function listUserCoupons(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserCouponView[]> {
  const out: UserCouponView[] = [];
  const discount = await getActiveDiscountCoupon(supabase, userId);
  if (discount) {
    if (discount.discount_fixed_krw && discount.discount_fixed_krw > 0) {
      out.push({
        kind: "fixed",
        id: discount.id,
        label: couponLabel(discount),
        discount_fixed_krw: discount.discount_fixed_krw,
        expires_at: discount.expires_at,
        source: discount.source,
      });
    } else {
      out.push({
        kind: "percent",
        id: discount.id,
        label: couponLabel(discount),
        discount_pct: discount.discount_pct,
        expires_at: discount.expires_at,
        source: discount.source,
      });
    }
  }
  const dream = await getActiveDreamPass(supabase, userId);
  if (dream) {
    out.push({
      kind: "dream_free",
      id: dream.id,
      label: dreamPassLabel(dream),
      quantity: dream.quantity,
      expires_at: dream.expires_at,
      source: dream.source,
    });
  }
  return out;
}

export function resolveCheckoutCouponApply(input: {
  product_slug: string;
  price_krw: number;
  discountCoupon: DiscountCouponRow | null;
  dreamPass: DreamPassRow | null;
}): CheckoutCouponApply {
  const price = Math.max(0, Math.floor(input.price_krw));
  const isCreditTopup =
    input.product_slug.startsWith("credit-package") ||
    input.product_slug.includes("voice-credit") ||
    input.product_slug.startsWith("credit");

  if (isCreditTopup || price <= 0) {
    return {
      final_price_krw: price,
      discount_krw: 0,
      label: "",
      consume_discount_coupon_id: null,
      consume_dream_pass_id: null,
    };
  }

  if (input.product_slug === "dream-lastnight" && input.dreamPass) {
    return {
      final_price_krw: 0,
      discount_krw: price,
      label: dreamPassLabel(input.dreamPass),
      consume_discount_coupon_id: null,
      consume_dream_pass_id: input.dreamPass.id,
    };
  }

  const coupon = input.discountCoupon;
  if (!coupon) {
    return {
      final_price_krw: price,
      discount_krw: 0,
      label: "",
      consume_discount_coupon_id: null,
      consume_dream_pass_id: null,
    };
  }

  let discount = 0;
  if (coupon.discount_fixed_krw && coupon.discount_fixed_krw > 0) {
    discount = Math.min(price, coupon.discount_fixed_krw);
  } else if (coupon.discount_pct > 0) {
    discount = Math.min(price, Math.floor((price * coupon.discount_pct) / 100));
  }

  if (discount <= 0) {
    return {
      final_price_krw: price,
      discount_krw: 0,
      label: "",
      consume_discount_coupon_id: null,
      consume_dream_pass_id: null,
    };
  }

  return {
    final_price_krw: Math.max(0, price - discount),
    discount_krw: discount,
    label: couponLabel(coupon),
    consume_discount_coupon_id: coupon.id,
    consume_dream_pass_id: null,
  };
}

async function tryGrantPendingMissionCoupons(supabase: SupabaseClient, userId: string, now: Date) {
  const active = await getActiveDiscountCoupon(supabase, userId);
  if (active) return;

  const { data: pendingRows } = await supabase
    .from("user_mission_coupon_pending")
    .select("mission_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (!pendingRows?.length) return;

  for (const row of pendingRows) {
    const missionId = String(row.mission_id) as MissionId;
    if (missionId === "M05") {
      await grantDreamPassDirect(supabase, userId, now, "mission_m05");
      await supabase.from("user_mission_coupon_pending").delete().eq("user_id", userId).eq("mission_id", missionId);
      continue;
    }
    const granted = await grantDiscountCouponDirect(
      supabase,
      userId,
      now,
      missionId as "M01" | "M09",
    );
    if (granted) {
      await supabase.from("user_mission_coupon_pending").delete().eq("user_id", userId).eq("mission_id", missionId);
    }
  }
}

async function grantDiscountCouponDirect(
  supabase: SupabaseClient,
  userId: string,
  now: Date,
  missionId: Extract<MissionId, "M01" | "M09">,
): Promise<boolean> {
  const active = await getActiveDiscountCoupon(supabase, userId);
  if (active) return false;

  const expires = new Date(now.getTime() + COUPON_TTL_MS).toISOString();
  const payload =
    missionId === "M01"
      ? { user_id: userId, discount_pct: 0, discount_fixed_krw: 5000, source: "mission_m01", expires_at: expires }
      : { user_id: userId, discount_pct: 10, discount_fixed_krw: null, source: "mission_m09", expires_at: expires };

  const { error } = await supabase.from("user_discount_coupons").insert(payload);
  if (error?.code === "23505") return false;
  if (error) throw error;
  return true;
}

async function grantDreamPassDirect(
  supabase: SupabaseClient,
  userId: string,
  now: Date,
  source: string,
) {
  const expires = new Date(now.getTime() + COUPON_TTL_MS).toISOString();
  const { error } = await supabase.from("user_dream_interpretation_passes").insert({
    user_id: userId,
    quantity: 1,
    expires_at: expires,
    source,
  });
  if (error) throw error;
}

export async function grantMissionCouponReward(
  supabase: SupabaseClient,
  userId: string,
  missionId: MissionId,
  now = new Date(),
): Promise<{ granted: boolean; pending: boolean; kind: "discount" | "dream" | "none" }> {
  if (!COUPON_MISSION_IDS.has(missionId)) {
    return { granted: false, pending: false, kind: "none" };
  }

  if (missionId === "M05") {
    await grantDreamPassDirect(supabase, userId, now, "mission_m05");
    return { granted: true, pending: false, kind: "dream" };
  }

  const active = await getActiveDiscountCoupon(supabase, userId);
  if (active) {
    await supabase.from("user_mission_coupon_pending").upsert(
      { user_id: userId, mission_id: missionId },
      { onConflict: "user_id,mission_id" },
    );
    return { granted: false, pending: true, kind: "discount" };
  }

  const ok = await grantDiscountCouponDirect(supabase, userId, now, missionId as "M01" | "M09");
  if (!ok) {
    await supabase.from("user_mission_coupon_pending").upsert(
      { user_id: userId, mission_id: missionId },
      { onConflict: "user_id,mission_id" },
    );
    return { granted: false, pending: true, kind: "discount" };
  }
  return { granted: true, pending: false, kind: "discount" };
}

export async function consumeCheckoutCoupons(
  supabase: SupabaseClient,
  userId: string,
  apply: CheckoutCouponApply | Pick<CheckoutCouponApply, "consume_discount_coupon_id" | "consume_dream_pass_id">,
) {
  const nowIso = new Date().toISOString();
  if (apply.consume_discount_coupon_id) {
    await supabase
      .from("user_discount_coupons")
      .update({ consumed_at: nowIso })
      .eq("id", apply.consume_discount_coupon_id)
      .eq("user_id", userId)
      .is("consumed_at", null);
    await tryGrantPendingMissionCoupons(supabase, userId, new Date());
  }
  if (apply.consume_dream_pass_id) {
    const { data } = await supabase
      .from("user_dream_interpretation_passes")
      .select("id,quantity")
      .eq("id", apply.consume_dream_pass_id)
      .eq("user_id", userId)
      .maybeSingle();
    const qty = Math.max(0, Number(data?.quantity ?? 0) - 1);
    if (data?.id) {
      if (qty <= 0) {
        await supabase
          .from("user_dream_interpretation_passes")
          .update({ quantity: 0, expires_at: nowIso })
          .eq("id", data.id);
      } else {
        await supabase.from("user_dream_interpretation_passes").update({ quantity: qty }).eq("id", data.id);
      }
    }
  }
}

export function missionGrantKey(missionId: MissionId, cadence: "once" | "daily" | "hours24" | "unlimited", now = new Date()) {
  if (cadence === "once") return `once:${missionId}`;
  if (cadence === "daily") return `daily:${missionId}:${formatKstDateKey(now)}`;
  if (cadence === "hours24") return `hours24:${missionId}:${formatKstDateKey(now)}`;
  return `unlimited:${missionId}`;
}

export async function grantMissionCreditsIfNew(
  supabase: SupabaseClient,
  userId: string,
  missionId: MissionId,
  grantKey: string,
): Promise<{ granted: number; duplicate: boolean }> {
  const credits = missionRewardCredits(missionId);
  if (credits <= 0) return { granted: 0, duplicate: false };

  const { data: existing } = await supabase
    .from("user_mission_reward_grants")
    .select("id")
    .eq("user_id", userId)
    .eq("grant_key", grantKey)
    .maybeSingle();
  if (existing?.id) return { granted: 0, duplicate: true };

  const minutes = credits / VOICE_MINUTE_CREDITS;
  await adminAdjustCredits(userId, 0, credits, {
    kind: "admin_adjust",
    memo: `미션 ${missionId} · 음성 ${minutes}분(${credits.toLocaleString("ko-KR")} 크레딧)`,
    ref_type: "mission",
    ref_id: missionId,
  });

  await supabase.from("user_mission_reward_grants").insert({
    user_id: userId,
    grant_key: grantKey,
    mission_id: missionId,
    reward_kind: "credits",
  });

  return { granted: credits, duplicate: false };
}

export { VOICE_MINUTE_CREDITS };
