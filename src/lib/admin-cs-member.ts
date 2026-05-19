import {
  getWallet,
  isLoggedInUserId,
  listLedger,
  type CreditLedgerRow,
  type CreditWalletRow,
} from "@/lib/credit-server";
import { supabaseServer } from "@/lib/supabase/server";

const BRANCH_LABEL: Record<string, string> = {
  zi: "자시",
  chou: "축시",
  yin: "인시",
  mao: "묘시",
  chen: "진시",
  si: "사시",
  wu: "오시",
  wei: "미시",
  shen: "신시",
  you: "유시",
  xu: "술시",
  hai: "해시",
};

const KIND_LABEL: Record<string, string> = {
  purchase: "충전",
  spend_chat: "채팅 차감",
  spend_voice: "음성 차감",
  spend_fortune: "점사 차감",
  admin_adjust: "어드민 조정",
  cs_refund: "CS 환불",
  migration_import: "이전",
  trial_grant: "체험 지급",
};

const PROVIDER_LABEL: Record<string, string> = {
  naver: "네이버",
  kakao: "카카오",
  google: "구글",
};

function titleFromPayload(raw: unknown, slug: string): string {
  const t =
    raw && typeof raw === "object" && "title" in raw ? String((raw as { title?: string }).title ?? "").trim() : "";
  if (t) return t;
  if (slug.startsWith("credit-package")) return "크레딧 충전";
  return slug.replace(/-/g, " ");
}

function methodLabel(method: string): string {
  const m = method.toLowerCase();
  if (m === "card") return "카드";
  if (m === "phone") return "휴대폰";
  if (m === "credit") return "크레딧";
  return method || "—";
}

export type AdminMemberFileMember = {
  user_id: string;
  display_name: string;
  email: string | null;
  provider: string | null;
  provider_label: string | null;
  provider_id: string | null;
  social_name: string | null;
  joined_at: string | null;
  last_login_at: string | null;
  profile_updated_at: string | null;
};

export type AdminMemberFileProfile = {
  name: string;
  gender_label: string;
  birth_label: string;
  birth_branch_label: string | null;
  calendar_label: string;
  onboarding_completed_at: string | null;
  is_primary: boolean;
};

export type AdminMemberFileWallet = {
  paid: number;
  free: number;
  total: number;
  free_expires_at: string;
  first_purchase_done: boolean;
  wallet_exists: boolean;
};

export type AdminMemberFilePaymentRow = {
  id: string;
  order_no: string;
  method: string;
  method_label: string;
  payment_info: string;
  amount_krw: number;
  bonus_credits: number;
  product_slug: string;
  title: string;
  paid_at: string;
};

export type AdminMemberFileUsageRow = {
  id: string;
  usage_type: "charge" | "deduct" | "adjust";
  usage_type_label: string;
  kind: string;
  kind_label: string;
  amount: number;
  delta_paid: number;
  delta_free: number;
  code: string | null;
  code_name: string;
  expires_at: string | null;
  created_at: string;
  memo: string | null;
};

export type AdminMemberFileActivity = {
  fortune_requests: number;
  voice_sessions: number;
  text_chat_sessions: number;
};

export type AdminMemberFile = {
  member: AdminMemberFileMember;
  profiles: AdminMemberFileProfile[];
  wallet: AdminMemberFileWallet;
  payment_totals_by_year: { year: number; total_krw: number }[];
  payments: AdminMemberFilePaymentRow[];
  usage_log: AdminMemberFileUsageRow[];
  activity: AdminMemberFileActivity;
};

function formatProfileRow(
  row: {
    display_name: string;
    birth_year: number | null;
    birth_month: number | null;
    birth_day: number | null;
    calendar_type: string;
    birth_branch_key: string | null;
    birth_time_unknown: boolean;
    gender: string;
    onboarding_completed_at: string | null;
  },
  isPrimary: boolean,
): AdminMemberFileProfile {
  const cal =
    row.calendar_type === "lunar-leap" ? "음력(윤달)" : row.calendar_type === "lunar" ? "음력" : "양력";
  const y = row.birth_year;
  const m = row.birth_month;
  const d = row.birth_day;
  const birth =
    y && m && d ? `${cal}) ${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : "미입력";
  const branch =
    !row.birth_time_unknown && row.birth_branch_key
      ? BRANCH_LABEL[row.birth_branch_key] ?? row.birth_branch_key
      : row.birth_time_unknown
        ? "시간 모름"
        : null;

  return {
    name: row.display_name || "—",
    gender_label: row.gender === "male" ? "남" : "여",
    birth_label: birth,
    birth_branch_label: branch,
    calendar_label: cal,
    onboarding_completed_at: row.onboarding_completed_at,
    is_primary: isPrimary,
  };
}

function walletView(wallet: CreditWalletRow): AdminMemberFileWallet {
  const freeEff =
    new Date(wallet.free_expires_at).getTime() >= Date.now() ? Math.max(0, wallet.free_balance) : 0;
  return {
    paid: wallet.paid_balance,
    free: freeEff,
    total: wallet.paid_balance + freeEff,
    free_expires_at: wallet.free_expires_at,
    first_purchase_done: wallet.first_purchase_done,
    wallet_exists: true,
  };
}

async function resolveCodeNames(
  ledger: CreditLedgerRow[],
): Promise<Map<string, string>> {
  const slugs = new Set<string>();
  const orderIds = new Set<string>();

  for (const row of ledger) {
    if (row.ref_type === "product" && row.ref_id) slugs.add(row.ref_id);
    if (row.ref_type === "order" && row.ref_id) orderIds.add(row.ref_id);
  }

  const sb = supabaseServer();
  const names = new Map<string, string>();

  if (slugs.size > 0) {
    const { data } = await sb.from("products").select("slug,title").in("slug", [...slugs]);
    for (const p of data ?? []) {
      names.set(`product:${p.slug}`, String(p.title ?? p.slug));
    }
  }

  if (orderIds.size > 0) {
    const { data } = await sb.from("orders").select("id,order_no,product_slug").in("id", [...orderIds]);
    for (const o of data ?? []) {
      names.set(`order:${o.id}`, String(o.order_no ?? o.product_slug ?? o.id));
    }
  }

  return names;
}

function mapUsageRow(row: CreditLedgerRow, codeNames: Map<string, string>, freeExpires: string | null): AdminMemberFileUsageRow {
  const paid = row.delta_paid;
  const free = row.delta_free;
  const amount = paid + free;
  const isCharge = amount > 0;
  const isDeduct = amount < 0;

  let usage_type: AdminMemberFileUsageRow["usage_type"] = "adjust";
  let usage_type_label = "조정";
  if (row.kind === "purchase" || row.kind === "trial_grant" || row.kind === "migration_import" || row.kind === "cs_refund") {
    usage_type = "charge";
    usage_type_label = row.kind === "purchase" ? "충전" : KIND_LABEL[row.kind] ?? "충전";
  } else if (row.kind.startsWith("spend_")) {
    usage_type = "deduct";
    usage_type_label = "차감";
  } else if (row.kind === "admin_adjust") {
    usage_type = isCharge ? "charge" : isDeduct ? "deduct" : "adjust";
    usage_type_label = isCharge ? "충전" : isDeduct ? "차감" : "조정";
  }

  let code_name = row.memo ?? KIND_LABEL[row.kind] ?? row.kind;
  if (row.ref_type === "product" && row.ref_id) {
    code_name = codeNames.get(`product:${row.ref_id}`) ?? row.ref_id;
  } else if (row.ref_type === "order" && row.ref_id) {
    const on = codeNames.get(`order:${row.ref_id}`);
    code_name = on ? `주문 ${on}` : code_name;
  } else if (row.ref_type === "voice_session" && row.ref_id) {
    code_name = row.memo ?? "음성 상담";
  }

  return {
    id: row.id,
    usage_type,
    usage_type_label,
    kind: row.kind,
    kind_label: KIND_LABEL[row.kind] ?? row.kind,
    amount,
    delta_paid: paid,
    delta_free: free,
    code: row.ref_id,
    code_name,
    expires_at: free !== 0 ? freeExpires : null,
    created_at: row.created_at,
    memo: row.memo,
  };
}

export async function getAdminMemberFile(userId: string): Promise<AdminMemberFile> {
  if (!isLoggedInUserId(userId)) {
    throw new Error("invalid_user_id");
  }

  const sb = supabaseServer();

  const [{ data: profile }, { data: social }, authRes] = await Promise.all([
    sb
      .from("profiles")
      .select(
        "display_name,birth_year,birth_month,birth_day,calendar_type,birth_branch_key,birth_time_unknown,gender,onboarding_completed_at,created_at,updated_at",
      )
      .eq("id", userId)
      .maybeSingle(),
    sb
      .from("yeonun_social_users")
      .select("provider,provider_id,name,email,created_at,last_login_at")
      .eq("auth_user_id", userId)
      .is("deleted_at", null)
      .order("last_login_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.auth.admin.getUserById(userId),
  ]);

  const authUser = authRes.data.user;

  const member: AdminMemberFileMember = {
    user_id: userId,
    display_name: String(profile?.display_name ?? social?.name ?? ""),
    email: authUser?.email ?? social?.email ?? null,
    provider: social?.provider ?? null,
    provider_label: social?.provider ? PROVIDER_LABEL[social.provider] ?? social.provider : null,
    provider_id: social?.provider_id ?? null,
    social_name: social?.name ?? null,
    joined_at: authUser?.created_at ?? social?.created_at ?? profile?.created_at ?? null,
    last_login_at: social?.last_login_at ?? authUser?.last_sign_in_at ?? null,
    profile_updated_at: profile?.updated_at ?? null,
  };

  const profiles: AdminMemberFileProfile[] = [];
  if (profile) {
    profiles.push(
      formatProfileRow(
        {
          display_name: profile.display_name,
          birth_year: profile.birth_year,
          birth_month: profile.birth_month,
          birth_day: profile.birth_day,
          calendar_type: profile.calendar_type,
          birth_branch_key: profile.birth_branch_key,
          birth_time_unknown: profile.birth_time_unknown,
          gender: profile.gender,
          onboarding_completed_at: profile.onboarding_completed_at,
        },
        true,
      ),
    );
  }

  const walletRow = await getWallet(userId);
  const walletExists = Boolean(walletRow);

  const ledger = walletExists ? await listLedger(userId, 80) : [];
  const codeNames = await resolveCodeNames(ledger);
  const usage_log = ledger.map((row) =>
    mapUsageRow(row, codeNames, walletRow?.free_expires_at ?? null),
  );

  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  const { data: orderRows } = await sb
    .from("orders")
    .select("id,order_no,product_slug,amount_krw,status,created_at")
    .eq("user_ref", userId)
    .eq("status", "paid")
    .gte("created_at", threeYearsAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(100);

  const orders = orderRows ?? [];
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const orderIds = orders.map((o) => o.id);

  const payments: AdminMemberFilePaymentRow[] = [];
  const yearTotals = new Map<number, number>();

  if (orderIds.length > 0) {
    const { data: payRows } = await sb
      .from("payments")
      .select("id,order_id,method,status,paid_at,raw_payload")
      .in("order_id", orderIds)
      .eq("status", "paid")
      .not("paid_at", "is", null)
      .order("paid_at", { ascending: false });

    for (const p of payRows ?? []) {
      const ord = p.order_id ? orderMap.get(p.order_id) : undefined;
      if (!ord) continue;

      const raw = (p.raw_payload ?? {}) as Record<string, unknown>;
      const grantBase = Number(raw.grant_base);
      const bonus = Number.isFinite(grantBase) && grantBase > 0 ? Math.floor(grantBase) : 0;
      const slug = ord.product_slug ?? "";
      const paidAt = String(p.paid_at ?? ord.created_at);

      const y = new Date(paidAt).getFullYear();
      if (Number.isFinite(y)) {
        yearTotals.set(y, (yearTotals.get(y) ?? 0) + ord.amount_krw);
      }

      let paymentInfo = PROVIDER_LABEL[String(raw.provider ?? "")] ?? "";
      if (!paymentInfo && raw.payment_code) paymentInfo = `코드 ${raw.payment_code}`;

      payments.push({
        id: p.id,
        order_no: ord.order_no,
        method: p.method ?? "card",
        method_label: methodLabel(p.method ?? "card"),
        payment_info: paymentInfo || "—",
        amount_krw: ord.amount_krw,
        bonus_credits: bonus,
        product_slug: slug,
        title: titleFromPayload(raw, slug),
        paid_at: paidAt,
      });
    }
  }

  const payment_totals_by_year = [...yearTotals.entries()]
    .map(([year, total_krw]) => ({ year, total_krw }))
    .sort((a, b) => b.year - a.year);

  const [fortuneCount, voiceCount, chatCount] = await Promise.all([
    sb.from("fortune_requests").select("id", { count: "exact", head: true }).eq("user_ref", userId),
    sb.from("voice_sessions").select("id", { count: "exact", head: true }).eq("user_ref", userId),
    sb.from("text_chat_sessions").select("id", { count: "exact", head: true }).eq("user_ref", userId),
  ]);

  return {
    member,
    profiles,
    wallet: walletRow
      ? { ...walletView(walletRow), wallet_exists: true }
      : {
          paid: 0,
          free: 0,
          total: 0,
          free_expires_at: "",
          first_purchase_done: false,
          wallet_exists: false,
        },
    payment_totals_by_year,
    payments,
    usage_log,
    activity: {
      fortune_requests: fortuneCount.count ?? 0,
      voice_sessions: voiceCount.count ?? 0,
      text_chat_sessions: chatCount.count ?? 0,
    },
  };
}
