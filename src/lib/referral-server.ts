import type { SupabaseClient } from "@supabase/supabase-js";

import { addKstCalendarDays, formatKstDateKey } from "@/lib/datetime/kst";
import { grantMissionCreditsIfNew } from "@/lib/mission-coupon-server";

const REFERRAL_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function hashToCode(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  let state = Math.abs(h) >>> 0 || 1;
  for (let i = 0; i < 8; i++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    out += REFERRAL_CODE_ALPHABET[state % REFERRAL_CODE_ALPHABET.length];
  }
  return out;
}

export async function ensureReferralCode(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase.from("user_referral_codes").select("code").eq("user_id", userId).maybeSingle();
  if (data?.code) return String(data.code);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = hashToCode(`${userId}:${attempt}:${Date.now()}`);
    const { error } = await supabase.from("user_referral_codes").insert({ user_id: userId, code });
    if (!error) return code;
    if (error.code !== "23505") throw error;
  }
  throw new Error("referral_code_failed");
}

export async function claimReferralSignup(
  supabase: SupabaseClient,
  refereeUserId: string,
  code: string,
  assignedKstDate: string,
  opts?: { requireNewSignup?: boolean },
): Promise<{ ok: boolean; reason?: string; referrerUserId?: string }> {
  const normalized = String(code ?? "").trim().toUpperCase();
  if (!normalized) return { ok: false, reason: "invalid_code" };

  const { data: refRow } = await supabase
    .from("user_referral_codes")
    .select("user_id,code")
    .eq("code", normalized)
    .maybeSingle();
  if (!refRow?.user_id) return { ok: false, reason: "code_not_found" };

  const referrerId = refRow.user_id;
  if (referrerId === refereeUserId) return { ok: false, reason: "self_referral" };

  if (opts?.requireNewSignup) {
    const { data: socialRow } = await supabase
      .from("yeonun_social_users")
      .select("created_at")
      .eq("auth_user_id", refereeUserId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const createdMs = socialRow?.created_at ? new Date(String(socialRow.created_at)).getTime() : NaN;
    if (!Number.isFinite(createdMs) || Date.now() - createdMs > 20 * 60 * 1000) {
      return { ok: false, reason: "not_new_signup" };
    }
  }

  const { data: existing } = await supabase
    .from("referral_signups")
    .select("id")
    .eq("referee_user_id", refereeUserId)
    .maybeSingle();
  if (existing?.id) return { ok: false, reason: "already_referred" };

  const todayKst = formatKstDateKey(new Date());
  const deadline = addKstCalendarDays(assignedKstDate, 7);
  if (todayKst > deadline) return { ok: false, reason: "expired_window" };

  const { error: insErr } = await supabase.from("referral_signups").insert({
    referrer_user_id: referrerId,
    referee_user_id: refereeUserId,
    assigned_kst_date: assignedKstDate,
  });
  if (insErr) return { ok: false, reason: insErr.message };

  const grantKeyRef = `referral:referrer:${refereeUserId}`;
  const grantKeyNew = `referral:referee:${refereeUserId}`;
  await grantMissionCreditsIfNew(supabase, referrerId, "M08", grantKeyRef);
  await grantMissionCreditsIfNew(supabase, refereeUserId, "M08", grantKeyNew);

  await supabase
    .from("referral_signups")
    .update({ referrer_rewarded: true, referee_rewarded: true })
    .eq("referee_user_id", refereeUserId);

  return { ok: true, referrerUserId: referrerId };
}
