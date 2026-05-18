import { isFortuneMenuCatalogProductSlug } from "@/lib/credit-package-products";
import { formatKstConsultHeaderKo, getKstParts, kstAddDays, kstStartOfDay } from "@/lib/datetime/kst";
import { supabaseServer } from "@/lib/supabase/server";

export type AdminDashboardPeriod = "yesterday" | "7d" | "30d";

export type AdminDashboardPeriodSlice = {
  revenueKrw: number;
  revenuePrevKrw: number;
  orderCount: number;
  creditChargeCount: number;
  creditChargeKrw: number;
  newSignups: number;
  dailyRevenue: { label: string; krw: number }[];
  serviceMini: {
    voiceHours: number;
    chatMessages: number;
    fortuneCount: number;
    newSignups: number;
  };
  characterUsage: { key: string; name: string; han: string; color: string; count: number; pct: number }[];
  productRank: { rank: number; title: string; meta: string; count: number; han: string; color: string; charKey: string }[];
  funnel: {
    membersTotal: number;
    newSignups: number;
    fortuneOrVoice: number;
    paidOrders: number;
  };
};

export type AdminDashboardOpsKpis = {
  yesterdayRevenueKrw: number;
  yesterdayRevenuePrevKrw: number;
  weekRevenueKrw: number;
  weekRevenuePrevKrw: number;
  yesterdayDau: number;
  yesterdayDauPrev: number;
  yesterdaySignups: number;
  yesterdaySignupsPrev: number;
  creditChargeCount: number;
  creditChargeKrw: number;
  llmErrorTotal: number;
  llmErrorVoice: number;
  llmErrorFortune: number;
  llmErrorChat: number;
};

export type AdminDashboardData = {
  /** 집계 달력 기준 (어드민 KPI·어제/7일/30일) */
  aggregationLabel: string;
  statusKpis: {
    products: number;
    characters: number;
    reviews: number;
    paymentsReady: boolean;
    voiceReady: boolean;
    fortuneReady: boolean;
  };
  opsKpis: AdminDashboardOpsKpis;
  socialLogin: { google: number; kakao: number; naver: number; total: number };
  reviews: { total: number; avg: number; starCounts: [number, number, number, number, number] };
  alerts: { tone: "red" | "warn" | "ok"; title: string; desc: string; time: string }[];
  slices: Record<AdminDashboardPeriod, AdminDashboardPeriodSlice>;
};

const CHAR_COLORS: Record<string, { han: string; color: string; name: string; fill: string }> = {
  yeon: { han: "蓮", color: "#8C2A40", name: "연화", fill: "#F5DAE0" },
  yeo: { han: "麗", color: "#2D5444", name: "여연", fill: "#BBD2C2" },
  byeol: { han: "星", color: "#4D3D7A", name: "별하", fill: "#C9BCDF" },
  un: { han: "雲", color: "#2A3142", name: "운서", fill: "#B5BAC8" },
};

/** DB·앱 공통 character_key (구 mock 키 `star` → `byeol`) */
function normalizeCharacterKey(key: string): string {
  const k = key.trim().toLowerCase();
  if (k === "star") return "byeol";
  return k;
}

type OrderRow = { amount_krw: number; created_at: string; product_slug: string };
type VoiceRow = { character_key: string; duration_sec: number; started_at: string; user_ref?: string | null; status?: string };
type FortuneRow = { product_slug: string; created_at: string; status: string; user_ref?: string | null };
type ChatSessionRow = { user_ref?: string | null; started_at: string; character_key?: string | null };
type SocialRow = { provider: string; created_at: string };
type ProductRow = { slug: string; title: string; price_krw: number; character_key: string };

function inRange(iso: string, from: Date, to: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
}

function fmtMdKst(d: Date): string {
  const { month, day } = getKstParts(d);
  return `${month}/${day}`;
}

/** 1~5 정수 별점만 인정 (0·null·NaN은 낮은 별점 알림·분포에서 제외) */
function normalizeReviewStar(stars: unknown): number | null {
  const n = Number(stars);
  if (!Number.isFinite(n)) return null;
  const s = Math.round(n);
  if (s < 1 || s > 5) return null;
  return s;
}

function countDistinctUserRefs(
  voices: VoiceRow[],
  fortunes: FortuneRow[],
  chats: ChatSessionRow[],
  from: Date,
  to: Date,
): number {
  const refs = new Set<string>();
  for (const v of voices) {
    if (!inRange(v.started_at, from, to)) continue;
    const ref = String(v.user_ref ?? "").trim();
    if (ref) refs.add(`v:${ref}`);
  }
  for (const f of fortunes) {
    if (!inRange(f.created_at, from, to)) continue;
    const ref = String(f.user_ref ?? "").trim();
    if (ref) refs.add(`f:${ref}`);
  }
  for (const c of chats) {
    if (!inRange(c.started_at, from, to)) continue;
    const ref = String(c.user_ref ?? "").trim();
    if (ref) refs.add(`c:${ref}`);
  }
  return refs.size;
}

function charKeyFromSlug(slug: string): string {
  const s = slug.toLowerCase();
  if (s.includes("yeon")) return "yeon";
  if (s.includes("byeol") || s.includes("zimi") || s.includes("newyear") || s.includes("tojeong")) return "byeol";
  if (s.includes("yeo")) return "yeo";
  if (s.includes("un")) return "un";
  return "yeon";
}

function buildCharacterUsage(
  voices: VoiceRow[],
  fortunes: FortuneRow[],
  chats: ChatSessionRow[],
  from: Date,
  to: Date,
): AdminDashboardPeriodSlice["characterUsage"] {
  const charCounts: Record<string, number> = {};
  for (const v of voices) {
    if (!inRange(v.started_at, from, to)) continue;
    const k = normalizeCharacterKey(String(v.character_key ?? "yeon"));
    charCounts[k] = (charCounts[k] ?? 0) + 1;
  }
  for (const f of fortunes) {
    if (!inRange(f.created_at, from, to)) continue;
    const k = normalizeCharacterKey(charKeyFromSlug(String(f.product_slug ?? "")));
    charCounts[k] = (charCounts[k] ?? 0) + 1;
  }
  for (const c of chats) {
    if (!inRange(c.started_at, from, to)) continue;
    const k = normalizeCharacterKey(String(c.character_key ?? "yeon"));
    charCounts[k] = (charCounts[k] ?? 0) + 1;
  }
  const total = Object.values(charCounts).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(charCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => {
      const meta = CHAR_COLORS[key] ?? { han: "緣", color: "#1A1815", name: key, fill: "#E6E0D8" };
      return {
        key,
        name: meta.name,
        han: meta.han,
        color: meta.color,
        count,
        pct: Math.round((count / total) * 100),
      };
    });
}

function buildProductRank(
  orders: OrderRow[],
  products: Map<string, ProductRow>,
  from: Date,
  to: Date,
): AdminDashboardPeriodSlice["productRank"] {
  const counts: Record<string, number> = {};
  for (const o of orders) {
    if (!inRange(o.created_at, from, to)) continue;
    const slug = String(o.product_slug ?? "");
    if (slug.startsWith("credit-package-")) continue;
    counts[slug] = (counts[slug] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([slug, count], i) => {
      const p = products.get(slug);
      const ck = normalizeCharacterKey(String(p?.character_key ?? charKeyFromSlug(slug)));
      const meta = CHAR_COLORS[ck] ?? CHAR_COLORS.yeon;
      const title = p?.title ?? slug;
      const price = p?.price_krw ? `${Number(p.price_krw).toLocaleString("ko-KR")}원` : "";
      return {
        rank: i + 1,
        title,
        meta: price ? `${meta.name} · ${price}` : slug,
        count,
        han: meta.han,
        color: meta.color,
        charKey: ck,
      };
    });
}

function buildDailyRevenue(orders: OrderRow[], today: Date, dayCount: number): { label: string; krw: number }[] {
  const out: { label: string; krw: number }[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const from = kstAddDays(today, -i);
    const to = kstAddDays(from, 1);
    const krw = orders
      .filter((o) => inRange(o.created_at, from, to))
      .reduce((s, o) => s + Number(o.amount_krw || 0), 0);
    out.push({ label: i === 0 ? "오늘" : fmtMdKst(from), krw });
  }
  return out;
}

function buildSlice(
  period: AdminDashboardPeriod,
  today: Date,
  orders: OrderRow[],
  socials: SocialRow[],
  voices: VoiceRow[],
  fortunes: FortuneRow[],
  chatSessions: ChatSessionRow[],
  chatCount: number,
  products: Map<string, ProductRow>,
): AdminDashboardPeriodSlice {
  let from: Date;
  let prevFrom: Date;
  let prevTo: Date;
  let chartDays: number;

  if (period === "yesterday") {
    from = kstAddDays(today, -1);
    const to = today;
    prevFrom = kstAddDays(today, -2);
    prevTo = kstAddDays(today, -1);
    chartDays = 7;
    const periodOrders = orders.filter((o) => inRange(o.created_at, from, to));
    const prevOrders = orders.filter((o) => inRange(o.created_at, prevFrom, prevTo));
    const creditOrders = periodOrders.filter((o) => String(o.product_slug).startsWith("credit-package-"));
    const voiceInPeriod = voices.filter((v) => inRange(v.started_at, from, to));
    const fortuneInPeriod = fortunes.filter((f) => inRange(f.created_at, from, to));
    const signups = socials.filter((s) => inRange(s.created_at, from, to)).length;
    const voiceSec = voiceInPeriod.reduce((s, v) => s + Number(v.duration_sec || 0), 0);

    return {
      revenueKrw: periodOrders.reduce((s, o) => s + Number(o.amount_krw || 0), 0),
      revenuePrevKrw: prevOrders.reduce((s, o) => s + Number(o.amount_krw || 0), 0),
      orderCount: periodOrders.length,
      creditChargeCount: creditOrders.length,
      creditChargeKrw: creditOrders.reduce((s, o) => s + Number(o.amount_krw || 0), 0),
      newSignups: signups,
      dailyRevenue: buildDailyRevenue(orders, today, chartDays),
      serviceMini: {
        voiceHours: Math.round((voiceSec / 3600) * 10) / 10,
        chatMessages: chatCount,
        fortuneCount: fortuneInPeriod.length,
        newSignups: signups,
      },
      characterUsage: buildCharacterUsage(voices, fortunes, chatSessions, from, to),
      productRank: buildProductRank(orders, products, from, to),
      funnel: {
        membersTotal: socials.length,
        newSignups: signups,
        fortuneOrVoice: voiceInPeriod.length + fortuneInPeriod.length,
        paidOrders: periodOrders.length,
      },
    };
  }

  if (period === "7d") {
    from = kstAddDays(today, -7);
    const to = today;
    prevFrom = kstAddDays(today, -14);
    prevTo = kstAddDays(today, -7);
    chartDays = 7;
  } else {
    from = kstAddDays(today, -30);
    const to = today;
    prevFrom = kstAddDays(today, -60);
    prevTo = kstAddDays(today, -30);
    chartDays = 30;
  }

  const to = today;
  const periodOrders = orders.filter((o) => inRange(o.created_at, from, to));
  const prevOrders = orders.filter((o) => inRange(o.created_at, prevFrom, prevTo));
  const creditOrders = periodOrders.filter((o) => String(o.product_slug).startsWith("credit-package-"));
  const voiceInPeriod = voices.filter((v) => inRange(v.started_at, from, to));
  const fortuneInPeriod = fortunes.filter((f) => inRange(f.created_at, from, to));
  const signups = socials.filter((s) => inRange(s.created_at, from, to)).length;
  const voiceSec = voiceInPeriod.reduce((s, v) => s + Number(v.duration_sec || 0), 0);

  let chatsInPeriod = chatCount;
  if (period === "7d") chatsInPeriod = chatCount;
  if (period === "30d") chatsInPeriod = chatCount;

  return {
    revenueKrw: periodOrders.reduce((s, o) => s + Number(o.amount_krw || 0), 0),
    revenuePrevKrw: prevOrders.reduce((s, o) => s + Number(o.amount_krw || 0), 0),
    orderCount: periodOrders.length,
    creditChargeCount: creditOrders.length,
    creditChargeKrw: creditOrders.reduce((s, o) => s + Number(o.amount_krw || 0), 0),
    newSignups: signups,
    dailyRevenue: buildDailyRevenue(orders, today, chartDays),
    serviceMini: {
      voiceHours: Math.round((voiceSec / 3600) * 10) / 10,
      chatMessages: chatsInPeriod,
      fortuneCount: fortuneInPeriod.length,
      newSignups: signups,
    },
    characterUsage: buildCharacterUsage(voices, fortunes, chatSessions, from, to),
    productRank: buildProductRank(orders, products, from, to),
    funnel: {
      membersTotal: socials.length,
      newSignups: signups,
      fortuneOrVoice: voiceInPeriod.length + fortuneInPeriod.length,
      paidOrders: periodOrders.length,
    },
  };
}

export async function loadAdminDashboardData(): Promise<AdminDashboardData> {
  const sb = supabaseServer();
  const now = new Date();
  const today = kstStartOfDay(now);
  const since30 = kstAddDays(today, -30).toISOString();
  const yesterday = kstAddDays(today, -1);

  const [productsRes, charactersRes, reviewsRes, ordersRes, socialRes, voiceRes, fortuneRes, chatRes, chatSessionsRes, paymentsProbe, llmErrRes] =
    await Promise.all([
      sb.from("products").select("slug,title,price_krw,character_key"),
      sb.from("characters").select("key", { count: "exact", head: true }),
      sb.from("reviews").select("stars,created_at,is_published,product_slug,user_mask"),
      sb
        .from("orders")
        .select("amount_krw,status,created_at,product_slug")
        .eq("status", "paid")
        .gte("created_at", since30)
        .order("created_at", { ascending: false })
        .limit(2000),
      sb.from("yeonun_social_users").select("provider,created_at").is("deleted_at", null),
      sb
        .from("voice_sessions")
        .select("character_key,duration_sec,started_at,user_ref,status")
        .gte("started_at", since30)
        .limit(2000),
      sb
        .from("fortune_requests")
        .select("product_slug,created_at,status,user_ref")
        .gte("created_at", since30)
        .limit(2000),
      sb.from("text_chat_messages").select("id,created_at").gte("created_at", since30).limit(5000),
      sb.from("text_chat_sessions").select("user_ref,started_at,character_key").gte("started_at", since30).limit(2000),
      sb.from("payments").select("id").limit(1),
      sb
        .from("llm_error_events")
        .select("service,created_at")
        .eq("service", "chat")
        .gte("created_at", yesterday.toISOString())
        .lt("created_at", today.toISOString()),
    ]);

  const productRows = (productsRes.data ?? []) as ProductRow[];
  const products = new Map<string, ProductRow>();
  let catalogCount = 0;
  for (const p of productRows) {
    const slug = String(p.slug ?? "");
    if (!slug) continue;
    products.set(slug, p);
    if (isFortuneMenuCatalogProductSlug(slug)) catalogCount++;
  }

  const orders = (ordersRes.data ?? []) as OrderRow[];
  const socials = (socialRes.data ?? []) as SocialRow[];
  const voices = (voiceRes.data ?? []) as VoiceRow[];
  const fortunes = (fortuneRes.data ?? []) as FortuneRow[];
  const reviews = (reviewsRes.data ?? []) as {
    stars: number;
    is_published?: boolean;
    product_slug?: string;
    user_mask?: string;
  }[];

  const chatYesterday = (chatRes.data ?? []).filter((m: { created_at: string }) =>
    inRange(m.created_at, yesterday, today),
  ).length;
  const chat7d = (chatRes.data ?? []).filter((m: { created_at: string }) =>
    inRange(m.created_at, kstAddDays(today, -7), today),
  ).length;
  const chat30d = (chatRes.data ?? []).length;

  const starCounts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let starSum = 0;
  for (const r of reviews) {
    const s = normalizeReviewStar(r.stars);
    if (s == null) continue;
    starCounts[s - 1]++;
    starSum += s;
  }
  const reviewTotal = starCounts.reduce((a, b) => a + b, 0);

  const social = { google: 0, kakao: 0, naver: 0, total: 0 };
  for (const row of socials) {
    const p = row.provider as keyof typeof social;
    if (p === "google" || p === "kakao" || p === "naver") social[p]++;
    social.total++;
  }

  const chatSessions = chatSessionsRes.error ? [] : ((chatSessionsRes.data ?? []) as ChatSessionRow[]);

  const slices: Record<AdminDashboardPeriod, AdminDashboardPeriodSlice> = {
    yesterday: buildSlice("yesterday", today, orders, socials, voices, fortunes, chatSessions, chatYesterday, products),
    "7d": buildSlice("7d", today, orders, socials, voices, fortunes, chatSessions, chat7d, products),
    "30d": buildSlice("30d", today, orders, socials, voices, fortunes, chatSessions, chat30d, products),
  };
  const dayBeforeYesterday = kstAddDays(today, -2);

  const llmVoiceErrYesterday = voices.filter(
    (v) => inRange(v.started_at, yesterday, today) && String(v.status ?? "").toLowerCase() === "error",
  ).length;
  const llmFortuneErrYesterday = fortunes.filter(
    (f) => inRange(f.created_at, yesterday, today) && f.status === "failed",
  ).length;
  const llmChatErrYesterday = llmErrRes.error ? 0 : (llmErrRes.data ?? []).length;

  const opsKpis: AdminDashboardOpsKpis = {
    yesterdayRevenueKrw: slices.yesterday.revenueKrw,
    yesterdayRevenuePrevKrw: slices.yesterday.revenuePrevKrw,
    weekRevenueKrw: slices["7d"].revenueKrw,
    weekRevenuePrevKrw: slices["7d"].revenuePrevKrw,
    yesterdayDau: countDistinctUserRefs(voices, fortunes, chatSessions, yesterday, today),
    yesterdayDauPrev: countDistinctUserRefs(voices, fortunes, chatSessions, dayBeforeYesterday, yesterday),
    yesterdaySignups: slices.yesterday.newSignups,
    yesterdaySignupsPrev: socials.filter((s) => inRange(s.created_at, dayBeforeYesterday, yesterday)).length,
    creditChargeCount: slices.yesterday.creditChargeCount,
    creditChargeKrw: slices.yesterday.creditChargeKrw,
    llmErrorTotal: llmVoiceErrYesterday + llmFortuneErrYesterday + llmChatErrYesterday,
    llmErrorVoice: llmVoiceErrYesterday,
    llmErrorFortune: llmFortuneErrYesterday,
    llmErrorChat: llmChatErrYesterday,
  };

  const lowStarReviews = reviews.filter((r) => {
    const s = normalizeReviewStar(r.stars);
    return s !== null && s <= 2;
  });
  const failedFortune = llmFortuneErrYesterday;

  const alerts: AdminDashboardData["alerts"] = [];
  if (failedFortune > 0) {
    alerts.push({
      tone: "warn",
      title: `점사 요청 failed ${failedFortune}건`,
      desc: "fortune_requests.status=failed · Fortune Ops에서 확인하세요.",
      time: "어제",
    });
  }
  if (lowStarReviews.length > 0) {
    const sample = lowStarReviews
      .slice(0, 2)
      .map((r) => `${r.product_slug ?? "?"} · ${r.user_mask ?? "—"} · ★${normalizeReviewStar(r.stars)}`)
      .join(" / ");
    alerts.push({
      tone: "warn",
      title: `낮은 별점(★1~2) 후기 ${lowStarReviews.length}건`,
      desc:
        lowStarReviews.length === 1
          ? `Reviews 탭 — ${sample}`
          : `Reviews 탭에서 확인 — ${sample}${lowStarReviews.length > 2 ? " …" : ""}`,
      time: "누적",
    });
  }
  const y = slices.yesterday;
  if (y.revenuePrevKrw > 0 && y.revenueKrw > y.revenuePrevKrw) {
    const pct = Math.round(((y.revenueKrw - y.revenuePrevKrw) / y.revenuePrevKrw) * 100);
    alerts.push({
      tone: "ok",
      title: `어제 결제 매출 전일 대비 +${pct}%`,
      desc: "orders.status=paid · amount_krw 합계",
      time: fmtMdKst(yesterday),
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      tone: "ok",
      title: "특이 알림 없음",
      desc: "운영 상태가 정상 범위입니다.",
      time: fmtMdKst(today),
    });
  }

  return {
    aggregationLabel: formatKstConsultHeaderKo(now),
    statusKpis: {
      products: catalogCount,
      characters: charactersRes.count ?? 0,
      reviews: reviews.length,
      paymentsReady: !paymentsProbe.error,
      voiceReady: !voiceRes.error,
      fortuneReady: !fortuneRes.error,
    },
    opsKpis,
    socialLogin: social,
    reviews: {
      total: reviewTotal,
      avg: reviewTotal ? Math.round((starSum / reviewTotal) * 10) / 10 : 0,
      starCounts,
    },
    alerts,
    slices,
  };
}
