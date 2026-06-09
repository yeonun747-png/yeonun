import { syntheticEmail } from "@/lib/auth/social-user-service";
import type { SocialProvider } from "@/lib/auth/types";
import { CREDIT_FREE_TRIAL_GRANT, CREDIT_FREE_TRIAL_VALID_DAYS } from "@/lib/credit-policy";
import { resolveCreditGrantBase } from "@/lib/credit-grant-resolve";
import { supabaseServer } from "@/lib/supabase/server";

export type CreditLedgerKind =
  | "purchase"
  | "spend_chat"
  | "spend_voice"
  | "spend_fortune"
  | "admin_adjust"
  | "cs_refund"
  | "migration_import"
  | "trial_grant";

export type CreditWalletRow = {
  user_id: string;
  paid_balance: number;
  free_balance: number;
  free_expires_at: string;
  first_purchase_done: boolean;
};

export type CreditLedgerRow = {
  id: string;
  user_id: string;
  delta_paid: number;
  delta_free: number;
  paid_balance_after: number;
  free_balance_after: number;
  kind: CreditLedgerKind;
  ref_type: string | null;
  ref_id: string | null;
  memo: string | null;
  admin_actor: string | null;
  created_at: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLoggedInUserId(userRef: string | null | undefined): userRef is string {
  return Boolean(userRef && UUID_RE.test(userRef));
}

function defaultFreeExpiresAt(): string {
  return new Date(Date.now() + CREDIT_FREE_TRIAL_VALID_DAYS * 86400000).toISOString();
}

function effectiveFreeBalance(wallet: CreditWalletRow, now = Date.now()): number {
  const exp = new Date(wallet.free_expires_at).getTime();
  if (!Number.isFinite(exp) || exp < now) return 0;
  return Math.max(0, wallet.free_balance);
}

export function walletSpendableTotal(wallet: CreditWalletRow): number {
  return Math.max(0, wallet.paid_balance) + effectiveFreeBalance(wallet);
}

export async function getWallet(userId: string): Promise<CreditWalletRow | null> {
  const sb = supabaseServer();
  const { data, error } = await sb.from("user_credit_wallets").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as CreditWalletRow | null;
}

/** 신규 회원 지갑 — 항상 가입 체험 1170. 비로그인 기기 잔여는 이전하지 않음(별도 기기 체험). */
export async function ensureWallet(userId: string): Promise<CreditWalletRow> {
  const existing = await getWallet(userId);
  if (existing) return existing;

  const sb = supabaseServer();
  const { data, error } = await sb
    .from("user_credit_wallets")
    .insert({
      user_id: userId,
      paid_balance: 0,
      free_balance: CREDIT_FREE_TRIAL_GRANT,
      free_expires_at: defaultFreeExpiresAt(),
      first_purchase_done: false,
    })
    .select("*")
    .single();
  if (error) {
    const again = await getWallet(userId);
    if (again) return again;
    throw new Error(error.message);
  }
  const wallet = data as CreditWalletRow;

  await insertLedger(userId, {
    delta_paid: 0,
    delta_free: CREDIT_FREE_TRIAL_GRANT,
    paid_after: wallet.paid_balance,
    free_after: wallet.free_balance,
    kind: "trial_grant",
    memo: "신규 회원 무료 체험",
  });

  return wallet;
}

async function insertLedger(
  userId: string,
  p: {
    delta_paid: number;
    delta_free: number;
    paid_after: number;
    free_after: number;
    kind: CreditLedgerKind;
    ref_type?: string | null;
    ref_id?: string | null;
    memo?: string | null;
    admin_actor?: string | null;
  },
): Promise<CreditLedgerRow> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("user_credit_ledger")
    .insert({
      user_id: userId,
      delta_paid: p.delta_paid,
      delta_free: p.delta_free,
      paid_balance_after: p.paid_after,
      free_balance_after: p.free_after,
      kind: p.kind,
      ref_type: p.ref_type ?? null,
      ref_id: p.ref_id ?? null,
      memo: p.memo ?? null,
      admin_actor: p.admin_actor ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CreditLedgerRow;
}

/** 무료 먼저 차감 후 유료 */
export async function spendCredits(
  userId: string,
  amount: number,
  meta: {
    kind: Extract<CreditLedgerKind, "spend_chat" | "spend_voice" | "spend_fortune">;
    ref_type?: string | null;
    ref_id?: string | null;
    memo?: string | null;
  },
): Promise<{ wallet: CreditWalletRow; spent: number }> {
  const need = Math.max(0, Math.floor(amount));
  if (need <= 0) {
    const w = (await getWallet(userId)) ?? (await ensureWallet(userId));
    return { wallet: w, spent: 0 };
  }

  let wallet = await ensureWallet(userId);
  const freeEff = effectiveFreeBalance(wallet);
  const total = wallet.paid_balance + freeEff;
  if (total < need) {
    throw new Error("insufficient_credits");
  }

  let takeFree = Math.min(freeEff, need);
  let takePaid = need - takeFree;
  const newFree = wallet.free_balance - takeFree;
  const newPaid = wallet.paid_balance - takePaid;

  const sb = supabaseServer();
  const { data, error } = await sb
    .from("user_credit_wallets")
    .update({ paid_balance: newPaid, free_balance: newFree })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  wallet = data as CreditWalletRow;

  await insertLedger(userId, {
    delta_paid: -takePaid,
    delta_free: -takeFree,
    paid_after: newPaid,
    free_after: newFree,
    kind: meta.kind,
    ref_type: meta.ref_type,
    ref_id: meta.ref_id,
    memo: meta.memo,
  });

  return { wallet, spent: takeFree + takePaid };
}

export type GrantPurchaseCreditsResult = {
  wallet: CreditWalletRow;
  /** 이번 호출에서 실제로 지급했는지 (중복 complete 시 false) */
  granted: boolean;
};

/** PG 충전 완료 — 주문(order.id)당 1회만 지급 (DB unique + RPC) */
export async function grantPurchaseCredits(
  userId: string,
  baseGrant: number,
  opts: { orderId: string; firstBonus?: boolean },
): Promise<GrantPurchaseCreditsResult> {
  await ensureWallet(userId);

  const sb = supabaseServer();
  const { data, error } = await sb.rpc("grant_purchase_credits_if_new", {
    p_user_id: userId,
    p_order_id: opts.orderId,
    p_base_grant: Math.max(0, Math.floor(baseGrant)),
    p_first_bonus: Boolean(opts.firstBonus),
  });

  if (error) throw new Error(error.message);

  const row = (data ?? {}) as {
    granted?: boolean;
    duplicate?: boolean;
    paid_balance?: number;
    free_balance?: number;
    first_purchase_done?: boolean;
  };

  const wallet = await getWallet(userId);
  if (!wallet) throw new Error("wallet_not_found_after_grant");

  return {
    wallet,
    granted: Boolean(row.granted) && !row.duplicate,
  };
}

export async function fulfillCreditTopupForPaidOrder(
  userId: string,
  order: { id: string; amount_krw: number | null; product_slug?: string | null },
  paymentRaw: Record<string, unknown> | null | undefined,
): Promise<GrantPurchaseCreditsResult> {
  const productSlug = String(paymentRaw?.product_slug ?? order.product_slug ?? "").trim();
  const credits = resolveCreditGrantBase(productSlug, order.amount_krw ?? 0);
  if (credits <= 0) {
    throw new Error("invalid_credit_grant");
  }

  const wallet = await getWallet(userId);
  const firstBonus = wallet ? !wallet.first_purchase_done : false;

  return grantPurchaseCredits(userId, credits, {
    orderId: String(order.id),
    firstBonus,
  });
}

export async function adminAdjustCredits(
  userId: string,
  deltaPaid: number,
  deltaFree: number,
  opts: { kind: "admin_adjust" | "cs_refund"; memo: string; admin_actor?: string; ref_type?: string; ref_id?: string },
): Promise<{ wallet: CreditWalletRow; ledger: CreditLedgerRow }> {
  const dp = Math.floor(deltaPaid);
  const df = Math.floor(deltaFree);
  if (dp === 0 && df === 0) throw new Error("adjustment_zero");

  let wallet = await ensureWallet(userId);
  const freeEff = effectiveFreeBalance(wallet);
  const newPaid = wallet.paid_balance + dp;
  const newFree = wallet.free_balance + df;

  if (newPaid < 0 || newFree < 0 || freeEff + df < 0) {
    throw new Error("balance_would_be_negative");
  }

  const sb = supabaseServer();
  const { data, error } = await sb
    .from("user_credit_wallets")
    .update({ paid_balance: newPaid, free_balance: newFree })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  wallet = data as CreditWalletRow;

  const ledger = await insertLedger(userId, {
    delta_paid: dp,
    delta_free: df,
    paid_after: newPaid,
    free_after: newFree,
    kind: opts.kind,
    ref_type: opts.ref_type ?? null,
    ref_id: opts.ref_id ?? null,
    memo: opts.memo,
    admin_actor: opts.admin_actor ?? "admin",
  });

  return { wallet, ledger };
}

/** 출석 7일 연속 크레딧 보상 — 사이클·일자당 1회 */
export async function grantAttendanceCreditsIfNew(
  userId: string,
  cycle: number,
  todayKst: string,
  credits: number,
): Promise<{ granted: number; duplicate: boolean }> {
  const amount = Math.max(0, Math.floor(credits));
  if (amount <= 0) return { granted: 0, duplicate: false };

  const grantKey = `7d:cycle${cycle}:${todayKst}`;
  const sb = supabaseServer();
  const { data: existing } = await sb
    .from("user_credit_ledger")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "admin_adjust")
    .eq("ref_type", "attendance")
    .eq("ref_id", grantKey)
    .maybeSingle();
  if (existing?.id) return { granted: 0, duplicate: true };

  await adminAdjustCredits(userId, 0, amount, {
    kind: "admin_adjust",
    memo: `출석 7일 연속 달성 · ${amount.toLocaleString("ko-KR")} 크레딧`,
    ref_type: "attendance",
    ref_id: grantKey,
    admin_actor: "system",
  });

  return { granted: amount, duplicate: false };
}

/** 중복 auth 계정 통합 시 source 지갑 → target 지갑으로 합산 */
export async function mergeCreditWallets(
  targetUserId: string,
  sourceUserId: string,
  opts?: { memo?: string; admin_actor?: string },
): Promise<void> {
  if (targetUserId === sourceUserId) return;

  const source = await getWallet(sourceUserId);
  if (!source) return;

  const target = await ensureWallet(targetUserId);
  const sourceFreeEff = effectiveFreeBalance(source);
  const addPaid = source.paid_balance;
  const addFree = sourceFreeEff;

  if (addPaid === 0 && addFree === 0) return;

  const newPaid = target.paid_balance + addPaid;
  const newFree = target.free_balance + addFree;
  const freeExpMs = Math.max(
    new Date(target.free_expires_at).getTime(),
    new Date(source.free_expires_at).getTime(),
  );
  const firstPurchaseDone = target.first_purchase_done || source.first_purchase_done;

  const sb = supabaseServer();
  const { data: updated, error } = await sb
    .from("user_credit_wallets")
    .update({
      paid_balance: newPaid,
      free_balance: newFree,
      free_expires_at: new Date(freeExpMs).toISOString(),
      first_purchase_done: firstPurchaseDone,
    })
    .eq("user_id", targetUserId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const wallet = updated as CreditWalletRow;

  await insertLedger(targetUserId, {
    delta_paid: addPaid,
    delta_free: addFree,
    paid_after: wallet.paid_balance,
    free_after: wallet.free_balance,
    kind: "migration_import",
    ref_type: "account_merge",
    ref_id: sourceUserId,
    memo: opts?.memo ?? "계정 통합 크레딧 이전",
    admin_actor: opts?.admin_actor ?? null,
  });

  await sb
    .from("user_credit_wallets")
    .update({ paid_balance: 0, free_balance: 0 })
    .eq("user_id", sourceUserId);

  if (addPaid > 0 || addFree > 0) {
    const srcAfter = await getWallet(sourceUserId);
    if (srcAfter) {
      await insertLedger(sourceUserId, {
        delta_paid: -addPaid,
        delta_free: -addFree,
        paid_after: 0,
        free_after: 0,
        kind: "migration_import",
        ref_type: "account_merge",
        ref_id: targetUserId,
        memo: opts?.memo ?? "계정 통합으로 이전",
        admin_actor: opts?.admin_actor ?? null,
      });
    }
  }
}

export async function listLedger(userId: string, limit = 30): Promise<CreditLedgerRow[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("user_credit_ledger")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as CreditLedgerRow[];
}

/** purchase 원장이 있으면 first_purchase_done을 true로 보정 */
export async function reconcileFirstPurchaseDone(userId: string): Promise<CreditWalletRow | null> {
  let wallet = await getWallet(userId);
  if (!wallet) return null;
  if (wallet.first_purchase_done) return wallet;

  const sb = supabaseServer();
  const { count, error } = await sb
    .from("user_credit_ledger")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "purchase");
  if (error) throw new Error(error.message);
  if (!count || count <= 0) return wallet;

  const { data, error: updErr } = await sb
    .from("user_credit_wallets")
    .update({ first_purchase_done: true })
    .eq("user_id", userId)
    .select("*")
    .single();
  if (updErr) throw new Error(updErr.message);
  return data as CreditWalletRow;
}

export type AdminMemberSearchHit = {
  user_id: string;
  display_name: string;
  /** CS 표시용 — Auth 로그인 이메일 또는 synthetic */
  email: string | null;
  login_email: string | null;
  provider: string | null;
  provider_id: string | null;
  social_name: string | null;
};

type AdminSocialSearchRow = {
  auth_user_id: string;
  email: string | null;
  provider: string | null;
  provider_id: string | null;
  name: string | null;
};

const SOCIAL_SEARCH_SELECT = "auth_user_id,email,provider,provider_id,name";

function parseOAuthLoginEmail(email: string): { provider: SocialProvider; providerId: string } | null {
  const m = email.toLowerCase().match(/^(google|kakao|naver)\.([^@]+)@oauth\.yeonun\.kr$/);
  if (!m) return null;
  return { provider: m[1] as SocialProvider, providerId: m[2] };
}

function csEmailFromSocial(s: {
  email?: string | null;
  provider?: string | null;
  provider_id?: string | null;
}): string | null {
  const stored = s.email?.trim();
  if (stored) return stored;
  if (s.provider && s.provider_id) {
    return syntheticEmail(s.provider as SocialProvider, s.provider_id);
  }
  return null;
}

/** PostgREST ilike 와일드카드 이스케이프 */
function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function isEmailLocalPartQuery(raw: string): boolean {
  const q = raw.trim();
  if (!q || q.includes("@")) return false;
  if (q.length < 2) return false;
  return /^[\w.\-+]+$/.test(q);
}

function hitFromSocialRow(s: AdminSocialSearchRow, displayName?: string): AdminMemberSearchHit {
  const email = csEmailFromSocial(s);
  return {
    user_id: String(s.auth_user_id),
    display_name: String(displayName ?? s.name ?? ""),
    email,
    login_email: email,
    provider: s.provider ?? null,
    provider_id: s.provider_id ?? null,
    social_name: s.name ?? null,
  };
}

export async function searchMembersForAdmin(query: string): Promise<AdminMemberSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const sb = supabaseServer();
  const hits = new Map<string, AdminMemberSearchHit>();

  const add = (row: AdminMemberSearchHit) => {
    if (!row.user_id) return;
    const prev = hits.get(row.user_id);
    hits.set(row.user_id, prev ? { ...prev, ...row, email: row.email ?? prev.email } : row);
  };

  const addFromSocialRows = async (rows: AdminSocialSearchRow[]) => {
    for (const s of rows) {
      const uid = String(s.auth_user_id);
      const { data: profile } = await sb.from("profiles").select("display_name").eq("id", uid).maybeSingle();
      add(hitFromSocialRow(s, profile?.display_name ? String(profile.display_name) : undefined));
    }
  };

  if (UUID_RE.test(q)) {
    const { data: profile } = await sb.from("profiles").select("id,display_name").eq("id", q).maybeSingle();
    const { data: social } = await sb
      .from("yeonun_social_users")
      .select(SOCIAL_SEARCH_SELECT)
      .eq("auth_user_id", q)
      .is("deleted_at", null)
      .order("last_login_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (social) {
      add(hitFromSocialRow(social as AdminSocialSearchRow, profile?.display_name ? String(profile.display_name) : undefined));
    } else {
      const { data: authUser } = await sb.auth.admin.getUserById(q);
      add({
        user_id: q,
        display_name: String(profile?.display_name ?? ""),
        email: authUser.user?.email ?? null,
        login_email: authUser.user?.email ?? null,
        provider: null,
        provider_id: null,
        social_name: null,
      });
    }
  }

  if (isEmailLocalPartQuery(q)) {
    const localEsc = escapeIlikePattern(q);
    const { data: byLocalEmail } = await sb
      .from("yeonun_social_users")
      .select(SOCIAL_SEARCH_SELECT)
      .ilike("email", `%${localEsc}%@%`)
      .is("deleted_at", null)
      .limit(20);
    await addFromSocialRows((byLocalEmail ?? []) as AdminSocialSearchRow[]);
  }

  if (q.includes("@")) {
    const { data: rows } = await sb
      .from("yeonun_social_users")
      .select(SOCIAL_SEARCH_SELECT)
      .ilike("email", `%${q}%`)
      .is("deleted_at", null)
      .limit(20);
    await addFromSocialRows((rows ?? []) as AdminSocialSearchRow[]);

    const exactEmail = q.toLowerCase();
    const { data: exactRows } = await sb
      .from("yeonun_social_users")
      .select(SOCIAL_SEARCH_SELECT)
      .eq("email", exactEmail)
      .is("deleted_at", null)
      .limit(5);
    await addFromSocialRows((exactRows ?? []) as AdminSocialSearchRow[]);

    const oauthLogin = parseOAuthLoginEmail(exactEmail);
    if (oauthLogin) {
      const { data: rows } = await sb
        .from("yeonun_social_users")
        .select(SOCIAL_SEARCH_SELECT)
        .eq("provider", oauthLogin.provider)
        .eq("provider_id", oauthLogin.providerId)
        .is("deleted_at", null)
        .limit(5);
      await addFromSocialRows((rows ?? []) as AdminSocialSearchRow[]);
    }
  }

  const kakaoIdOnly = q.match(/^kakao\.(\d+)$/i);
  if (kakaoIdOnly) {
    const { data: rows } = await sb
      .from("yeonun_social_users")
      .select(SOCIAL_SEARCH_SELECT)
      .eq("provider", "kakao")
      .eq("provider_id", kakaoIdOnly[1])
      .is("deleted_at", null)
      .limit(10);
    await addFromSocialRows((rows ?? []) as AdminSocialSearchRow[]);
  }

  if (/^\d{6,20}$/.test(q)) {
    const { data: rows } = await sb
      .from("yeonun_social_users")
      .select(SOCIAL_SEARCH_SELECT)
      .eq("provider_id", q)
      .is("deleted_at", null)
      .limit(20);
    await addFromSocialRows((rows ?? []) as AdminSocialSearchRow[]);
  }

  if (q.startsWith("YN")) {
    const { data: order } = await sb.from("orders").select("user_ref").eq("order_no", q).maybeSingle();
    const uid = String(order?.user_ref ?? "");
    if (isLoggedInUserId(uid)) {
      const { data: profile } = await sb.from("profiles").select("display_name").eq("id", uid).maybeSingle();
      const { data: social } = await sb
        .from("yeonun_social_users")
        .select(SOCIAL_SEARCH_SELECT)
        .eq("auth_user_id", uid)
        .is("deleted_at", null)
        .order("last_login_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (social) {
        add(hitFromSocialRow(social as AdminSocialSearchRow, profile?.display_name ? String(profile.display_name) : undefined));
      } else {
        const { data: authUser } = await sb.auth.admin.getUserById(uid);
        add({
          user_id: uid,
          display_name: String(profile?.display_name ?? ""),
          email: authUser.user?.email ?? null,
          login_email: authUser.user?.email ?? null,
          provider: null,
          provider_id: null,
          social_name: null,
        });
      }
    }
  }

  if (hits.size < 15 && q.length >= 2) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id,display_name")
      .ilike("display_name", `%${q}%`)
      .limit(15);
    for (const p of profiles ?? []) {
      const uid = String(p.id);
      const { data: social } = await sb
        .from("yeonun_social_users")
        .select(SOCIAL_SEARCH_SELECT)
        .eq("auth_user_id", uid)
        .is("deleted_at", null)
        .order("last_login_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (social) {
        add(hitFromSocialRow(social as AdminSocialSearchRow, String(p.display_name ?? "")));
      } else {
        add({
          user_id: uid,
          display_name: String(p.display_name ?? ""),
          email: null,
          login_email: null,
          provider: null,
          provider_id: null,
          social_name: null,
        });
      }
    }

    const { data: socialByName } = await sb
      .from("yeonun_social_users")
      .select(SOCIAL_SEARCH_SELECT)
      .ilike("name", `%${q}%`)
      .is("deleted_at", null)
      .limit(15);
    await addFromSocialRows((socialByName ?? []) as AdminSocialSearchRow[]);
  }

  return [...hits.values()].slice(0, 20);
}
