import type { ClaudeFortuneUserInfo } from "@/lib/fortune-claude-payload";
import { CAROUSEL_CHAR, isCarouselCharKey } from "@/lib/characters/character-carousel-static";
import { getKstParts, kstAddDays, kstStartOfDay } from "@/lib/datetime/kst";
import { supabaseServer } from "@/lib/supabase/server";

export type AdminPaymentUsersPeriod = "today" | "yesterday" | "7d" | "30d";

export type AdminPaymentSajuLine = {
  birth: string;
  hour: string;
  gender: string;
};

export type AdminPaymentUserRow = {
  paymentId: string;
  paidAtIso: string;
  paidAtDate: string;
  paidAtTime: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  sajuSelf: AdminPaymentSajuLine | null;
  sajuPartner: AdminPaymentSajuLine | null;
  isPairProduct: boolean;
  sajuSourceNote: string | null;
  characterKey: string;
  characterName: string;
  characterHan: string;
  characterBg: string;
  characterColor: string;
  productTitle: string;
  categoryLabel: string;
  amountKrw: number;
  method: string;
  methodLabel: string;
  status: "ok" | "refund" | "pending";
};

export type AdminPaymentUsersSummary = {
  card: { krw: number; count: number };
  phone: { krw: number; count: number };
  total: { krw: number; count: number };
  credit: { credits: number; count: number };
};

export type AdminPaymentUsersPayload = {
  period: AdminPaymentUsersPeriod;
  count: number;
  totalKrw: number;
  summary: AdminPaymentUsersSummary;
  rows: AdminPaymentUserRow[];
};

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

const CHAR_STYLE: Record<string, { bg: string; color: string; han: string; name: string }> = {
  yeon: { bg: "#FCE4EC", color: "#C94B6A", han: "蓮", name: "연화" },
  byeol: { bg: "#EDE7F6", color: "#6A3AAF", han: "星", name: "별하" },
  yeo: { bg: "#E8F5E9", color: "#2D6A4F", han: "麗", name: "여연" },
  un: { bg: "#E3F2FD", color: "#1565C0", han: "雲", name: "운서" },
};

const CATEGORY_LABEL: Record<string, string> = {
  love: "연애",
  compat: "궁합",
  saju: "사주",
  dream: "꿈",
  naming: "작명",
  taekil: "택일",
  wealth: "재물",
  career: "직업",
  health: "건강",
  exam: "시험",
  family: "가족",
};

function pad2(n: number) {
  return String(Math.trunc(n)).padStart(2, "0");
}

export function adminPaymentPeriodFrom(iso: string): Date {
  return new Date(iso);
}

export function resolveAdminPaymentUsersRange(
  period: AdminPaymentUsersPeriod,
  now = new Date(),
): { from: Date; to: Date } {
  const today = kstStartOfDay(now);
  const tomorrow = kstAddDays(today, 1);
  if (period === "today") return { from: today, to: tomorrow };
  if (period === "yesterday") return { from: kstAddDays(today, -1), to: today };
  if (period === "7d") return { from: kstAddDays(today, -6), to: tomorrow };
  return { from: kstAddDays(today, -29), to: tomorrow };
}

function inPaymentRange(iso: string, from: Date, to: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
}

function formatPaymentDatetime(iso: string): { date: string; time: string } {
  const { year, month, day, hour, minute, second } = getKstParts(new Date(iso));
  return {
    date: `${year}.${pad2(month)}.${pad2(day)}`,
    time: `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`,
  };
}

function formatBirthYmd(y: number | null, m: number | null, d: number | null): string {
  if (!y || !m || !d) return "—";
  return `${y}.${pad2(m)}.${pad2(d)}`;
}

function formatProfileSaju(profile: {
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  birth_branch_key: string | null;
  birth_time_unknown: boolean | null;
  birth_minute: number | null;
  gender: string | null;
}): AdminPaymentSajuLine {
  const birth = formatBirthYmd(profile.birth_year, profile.birth_month, profile.birth_day);
  let hour = "모름";
  if (!profile.birth_time_unknown && profile.birth_branch_key) {
    const branch = BRANCH_LABEL[profile.birth_branch_key] ?? profile.birth_branch_key;
    const mi =
      profile.birth_minute != null && profile.birth_minute >= 0 && profile.birth_minute <= 59
        ? ` ${pad2(profile.birth_minute)}분`
        : "";
    hour = `${branch}${mi}`;
  }
  const gender = profile.gender === "male" ? "남" : profile.gender === "female" ? "여" : "—";
  return { birth, hour, gender };
}

function formatUserInfoSaju(u: ClaudeFortuneUserInfo): AdminPaymentSajuLine {
  const rawDate = String(u.birth_date ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate);
  const birth = m ? `${m[1]}.${m[2]}.${m[3]}` : rawDate || "—";
  const hourRaw = String(u.birth_hour ?? "").trim();
  const hour = hourRaw ? hourRaw.replace(/:00\s*\(시지.*\)/, "").trim() || hourRaw : "모름";
  const gender = String(u.gender ?? "").trim() || "—";
  return { birth, hour, gender };
}

function parsePayloadUserInfo(raw: unknown): ClaudeFortuneUserInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const birth_date = String(o.birth_date ?? "").trim();
  const name = String(o.name ?? "").trim();
  if (!birth_date && !name) return null;
  return {
    name: name || "—",
    gender: String(o.gender ?? "").trim(),
    birth_date,
    ...(o.birth_hour != null && String(o.birth_hour).trim() !== ""
      ? { birth_hour: String(o.birth_hour) }
      : {}),
  };
}

function extractUserInfoFromPayload(payload: unknown): {
  self: ClaudeFortuneUserInfo | null;
  partner: ClaudeFortuneUserInfo | null;
} {
  if (!payload || typeof payload !== "object") return { self: null, partner: null };
  const root = payload as Record<string, unknown>;

  const clientBody =
    root.client_body && typeof root.client_body === "object"
      ? (root.client_body as Record<string, unknown>)
      : null;
  if (clientBody) {
    const self = parsePayloadUserInfo(clientBody.user_info);
    const partner = parsePayloadUserInfo(clientBody.partner_info);
    if (self) {
      return { self, partner: partner?.birth_date ? partner : null };
    }
  }

  const upstream =
    root.cloudways_upstream && typeof root.cloudways_upstream === "object"
      ? (root.cloudways_upstream as Record<string, unknown>)
      : null;
  const fromUpstream = {
    self: parsePayloadUserInfo(upstream?.user_info),
    partner: parsePayloadUserInfo(upstream?.partner_info),
  };
  if (fromUpstream.self) {
    return {
      self: fromUpstream.self,
      partner: fromUpstream.partner?.birth_date ? fromUpstream.partner : null,
    };
  }

  const self = parsePayloadUserInfo(root.user_info);
  const partner = parsePayloadUserInfo(root.partner_info);
  if (self) {
    return { self, partner: partner?.birth_date ? partner : null };
  }

  return { self: null, partner: null };
}

/** PG: 카드 · 휴대폰 · 크레딧만 사용 */
function paymentMethodLabel(method: string): string {
  const m = String(method ?? "").trim().toLowerCase();
  if (m === "card") return "카드";
  if (m === "phone") return "휴대폰";
  if (m === "credit") return "크레딧";
  return "—";
}

function titleFromPayload(raw: unknown, slug: string): string {
  const t =
    raw && typeof raw === "object" && "title" in raw ? String((raw as { title?: string }).title ?? "").trim() : "";
  if (t) return t;
  if (slug.startsWith("credit-package")) return "크레딧 충전";
  return slug.replace(/-/g, " ");
}

function effectivePaidAt(paid_at: string | null, created_at: string): string {
  return paid_at && paid_at.trim() ? paid_at : created_at;
}

export async function loadAdminPaymentUsers(
  period: AdminPaymentUsersPeriod,
): Promise<AdminPaymentUsersPayload> {
  const sb = supabaseServer();
  const { from, to } = resolveAdminPaymentUsersRange(period);
  const fromIso = from.toISOString();

  const { data: paymentRows, error: payErr } = await sb
    .from("payments")
    .select("id, order_id, method, status, paid_at, created_at, raw_payload")
    .gte("created_at", fromIso)
    .order("created_at", { ascending: false })
    .limit(800);

  if (payErr) throw new Error(payErr.message);

  const payments = (paymentRows ?? []).filter((p) => {
    const at = effectivePaidAt(p.paid_at, p.created_at);
    return inPaymentRange(at, from, to);
  });

  const orderIds = [...new Set(payments.map((p) => p.order_id).filter(Boolean))] as string[];

  const [ordersRes, productsRes, categoriesRes] = await Promise.all([
    orderIds.length
      ? sb
          .from("orders")
          .select("id, order_no, user_ref, product_slug, amount_krw, status")
          .in("id", orderIds)
      : Promise.resolve({ data: [], error: null }),
    sb.from("products").select("slug, title, category_slug, character_key, saju_input_profile"),
    sb.from("categories").select("slug, label"),
  ]);

  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (productsRes.error) throw new Error(productsRes.error.message);

  const orderMap = new Map((ordersRes.data ?? []).map((o) => [o.id, o]));
  const productMap = new Map((productsRes.data ?? []).map((p) => [p.slug, p]));
  const categoryMap = new Map((categoriesRes.data ?? []).map((c) => [c.slug, c.label]));

  const paymentIds = payments.map((p) => p.id);
  const userRefs = [
    ...new Set(
      (ordersRes.data ?? [])
        .map((o) => String(o.user_ref ?? "").trim())
        .filter((u) => u && u !== "guest"),
    ),
  ];

  const [refundsRes, profilesRes, fortunesRes] = await Promise.all([
    paymentIds.length
      ? sb.from("refunds").select("payment_id, status, amount_krw").in("payment_id", paymentIds)
      : Promise.resolve({ data: [], error: null }),
    userRefs.length
      ? sb
          .from("profiles")
          .select(
            "id, display_name, birth_year, birth_month, birth_day, calendar_type, birth_branch_key, birth_time_unknown, birth_minute, gender",
          )
          .in("id", userRefs)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? sb
          .from("fortune_requests")
          .select("order_id, payload, created_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const refundedIds = new Set(
    (refundsRes.data ?? [])
      .filter((r) => {
        const st = String(r.status ?? "").toLowerCase();
        return st === "completed" || st === "processed" || st === "paid" || st === "refunded";
      })
      .map((r) => r.payment_id)
      .filter(Boolean),
  );

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

  const fortuneByOrder = new Map<string, { self: ClaudeFortuneUserInfo | null; partner: ClaudeFortuneUserInfo | null }>();
  for (const fr of fortunesRes.data ?? []) {
    if (!fr.order_id || fortuneByOrder.has(fr.order_id)) continue;
    fortuneByOrder.set(fr.order_id, extractUserInfoFromPayload(fr.payload));
  }

  const emailMap = new Map<string, string>();
  await Promise.all(
    userRefs.slice(0, 200).map(async (uid) => {
      try {
        const { data } = await sb.auth.admin.getUserById(uid);
        const email = data?.user?.email?.trim();
        if (email) emailMap.set(uid, email);
      } catch {
        /* ignore */
      }
    }),
  );

  const rows: AdminPaymentUserRow[] = [];

  for (const pay of payments) {
    const order = pay.order_id ? orderMap.get(pay.order_id) : null;
    if (!order) continue;

    const slug = String(order.product_slug ?? "").trim();
    const product = slug ? productMap.get(slug) : null;
    const uid = String(order.user_ref ?? "").trim();
    const profile = uid && uid !== "guest" ? profileMap.get(uid) : null;
    const fortuneSnap = pay.order_id ? fortuneByOrder.get(pay.order_id) : null;

    const isPair = String(product?.saju_input_profile ?? "single") === "pair";
    const profileSaju = profile ? formatProfileSaju(profile) : null;
    const snapSelf = fortuneSnap?.self ? formatUserInfoSaju(fortuneSnap.self) : null;
    const snapPartner = fortuneSnap?.partner ? formatUserInfoSaju(fortuneSnap.partner) : null;

    const sajuSelf = snapSelf ?? profileSaju;
    const sajuPartner: AdminPaymentSajuLine | null = isPair ? snapPartner : null;

    const paidAtIso = effectivePaidAt(pay.paid_at, pay.created_at);
    const { date: paidAtDate, time: paidAtTime } = formatPaymentDatetime(paidAtIso);
    const isRefund = refundedIds.has(pay.id);
    const payStatus = String(pay.status ?? "").toLowerCase();
    const status: AdminPaymentUserRow["status"] = isRefund
      ? "refund"
      : payStatus === "paid"
        ? "ok"
        : payStatus === "pending"
          ? "pending"
          : payStatus === "failed" || payStatus === "cancelled"
            ? "pending"
            : "ok";

    const charKey = String(product?.character_key ?? "yeon");
    const charStyle = CHAR_STYLE[charKey] ?? CHAR_STYLE.yeon;
    const carousel = isCarouselCharKey(charKey) ? CAROUSEL_CHAR[charKey] : null;

    const catSlug = String(product?.category_slug ?? "");
    const categoryLabel =
      String(categoryMap.get(catSlug) ?? "").trim() ||
      CATEGORY_LABEL[catSlug] ||
      catSlug ||
      "—";

    rows.push({
      paymentId: pay.id,
      paidAtIso,
      paidAtDate,
      paidAtTime,
      userId: uid && uid !== "guest" ? uid : null,
      userName:
        String(profile?.display_name ?? "").trim() ||
        (uid === "guest" ? "게스트" : carousel?.name ?? "—"),
      userEmail:
        uid && uid !== "guest"
          ? emailMap.get(uid) ?? "(이메일 없음)"
          : uid === "guest"
            ? "(비회원 주문)"
            : "(이메일 없음)",
      sajuSelf,
      sajuPartner,
      isPairProduct: isPair,
      sajuSourceNote: null,
      characterKey: charKey,
      characterName: carousel?.name ?? charStyle.name,
      characterHan: carousel?.han ?? charStyle.han,
      characterBg: charStyle.bg,
      characterColor: charStyle.color,
      productTitle: String(product?.title ?? titleFromPayload(pay.raw_payload, slug)),
      categoryLabel,
      amountKrw: Number(order.amount_krw ?? 0),
      method: String(pay.method ?? "").trim().toLowerCase(),
      methodLabel: paymentMethodLabel(pay.method),
      status,
    });
  }

  rows.sort((a, b) => new Date(b.paidAtIso).getTime() - new Date(a.paidAtIso).getTime());

  const summary: AdminPaymentUsersSummary = {
    card: { krw: 0, count: 0 },
    phone: { krw: 0, count: 0 },
    total: { krw: 0, count: 0 },
    credit: { credits: 0, count: 0 },
  };

  for (const row of rows) {
    if (row.status === "refund") continue;
    if (row.method === "card") {
      summary.card.krw += row.amountKrw;
      summary.card.count += 1;
    } else if (row.method === "phone") {
      summary.phone.krw += row.amountKrw;
      summary.phone.count += 1;
    } else if (row.method === "credit") {
      summary.credit.credits += row.amountKrw;
      summary.credit.count += 1;
    }
  }

  summary.total.krw = summary.card.krw + summary.phone.krw;
  summary.total.count = summary.card.count + summary.phone.count;

  const count = rows.filter((r) => r.status !== "refund").length;
  const totalKrw = summary.total.krw;

  return { period, count, totalKrw, summary, rows };
}
