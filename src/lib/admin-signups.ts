import { resolveAdminPaymentUsersRange, type AdminPaymentUsersPeriod } from "@/lib/admin-payment-users";
import { getKstParts, kstAddDays, kstStartOfDay } from "@/lib/datetime/kst";
import { supabaseServer } from "@/lib/supabase/server";

export type AdminSignupsPeriod = AdminPaymentUsersPeriod;
export type AdminSignupProviderFilter = "all" | "google" | "kakao" | "naver";

export type AdminSignupRow = {
  userId: string;
  provider: string;
  providerLabel: string;
  name: string;
  email: string;
  joinedAtIso: string;
  joinedAtLabel: string;
  lastLoginAtIso: string | null;
  lastLoginAtLabel: string;
  onboardingCompleted: boolean;
  referralSignup: boolean;
};

export type AdminSignupDailyPoint = {
  label: string;
  google: number;
  kakao: number;
  naver: number;
  total: number;
};

export type AdminSignupsPayload = {
  period: AdminSignupsPeriod;
  provider: AdminSignupProviderFilter;
  count: number;
  kpis: {
    periodSignups: number;
    periodSignupsPrev: number;
    cumulativeTotal: number;
    onboardingRate: number;
    byProvider: { google: number; kakao: number; naver: number };
    referralSignups: number;
  };
  dailyChart: AdminSignupDailyPoint[];
  rows: AdminSignupRow[];
};

const PROVIDER_LABEL: Record<string, string> = {
  google: "구글",
  kakao: "카카오",
  naver: "네이버",
};

type SocialRow = {
  auth_user_id: string;
  provider: string;
  name: string | null;
  email: string | null;
  created_at: string;
  last_login_at: string | null;
};

function pad2(n: number) {
  return String(Math.trunc(n)).padStart(2, "0");
}

function inRange(iso: string, from: Date, to: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
}

function fmtKstLabel(iso: string | null): string {
  if (!iso) return "—";
  const { year, month, day, hour, minute } = getKstParts(new Date(iso));
  return `${year}.${pad2(month)}.${pad2(day)} ${pad2(hour)}:${pad2(minute)}`;
}

function fmtChartLabel(d: Date): string {
  const { month, day } = getKstParts(d);
  return `${pad2(month)}/${pad2(day)}`;
}

function resolvePrevRange(period: AdminSignupsPeriod, now = new Date()): { from: Date; to: Date } {
  const today = kstStartOfDay(now);
  if (period === "today") return { from: kstAddDays(today, -1), to: today };
  if (period === "yesterday") return { from: kstAddDays(today, -2), to: kstAddDays(today, -1) };
  if (period === "7d") return { from: kstAddDays(today, -13), to: kstAddDays(today, -6) };
  return { from: kstAddDays(today, -59), to: kstAddDays(today, -29) };
}

function chartDayCount(period: AdminSignupsPeriod): number {
  if (period === "today" || period === "yesterday") return 1;
  if (period === "7d") return 7;
  return 30;
}

function matchesSearch(row: SocialRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const name = String(row.name ?? "").toLowerCase();
  const email = String(row.email ?? "").toLowerCase();
  return name.includes(needle) || email.includes(needle);
}

function matchesProvider(row: SocialRow, provider: AdminSignupProviderFilter): boolean {
  if (provider === "all") return true;
  return row.provider === provider;
}

function countByProvider(rows: SocialRow[]) {
  return {
    google: rows.filter((r) => r.provider === "google").length,
    kakao: rows.filter((r) => r.provider === "kakao").length,
    naver: rows.filter((r) => r.provider === "naver").length,
  };
}

function buildDailyChart(rows: SocialRow[], from: Date, days: number): AdminSignupDailyPoint[] {
  const points: AdminSignupDailyPoint[] = [];
  for (let i = 0; i < days; i++) {
    const dayStart = kstAddDays(from, i);
    const dayEnd = kstAddDays(dayStart, 1);
    const inDay = rows.filter((r) => inRange(r.created_at, dayStart, dayEnd));
    const by = countByProvider(inDay);
    points.push({
      label: fmtChartLabel(dayStart),
      google: by.google,
      kakao: by.kakao,
      naver: by.naver,
      total: inDay.length,
    });
  }
  return points;
}

export async function loadAdminSignups(
  period: AdminSignupsPeriod,
  provider: AdminSignupProviderFilter = "all",
  q = "",
): Promise<AdminSignupsPayload> {
  const sb = supabaseServer();
  const now = new Date();
  const { from, to } = resolveAdminPaymentUsersRange(period, now);
  const prev = resolvePrevRange(period, now);
  const search = q.trim().toLowerCase();

  const sinceChart = kstAddDays(kstStartOfDay(now), -29).toISOString();

  const [socialRes, referralRes] = await Promise.all([
    sb
      .from("yeonun_social_users")
      .select("auth_user_id,provider,name,email,created_at,last_login_at")
      .is("deleted_at", null)
      .gte("created_at", sinceChart)
      .order("created_at", { ascending: false })
      .limit(5000),
    sb.from("referral_signups").select("referee_user_id").gte("created_at", sinceChart).limit(5000),
  ]);

  const allRecent = (socialRes.data ?? []) as SocialRow[];
  const cumulativeRes = await sb
    .from("yeonun_social_users")
    .select("auth_user_id", { count: "exact", head: true })
    .is("deleted_at", null);
  const cumulativeTotal = cumulativeRes.count ?? 0;

  const referralSet = new Set(
    ((referralRes.data ?? []) as { referee_user_id?: string }[])
      .map((r) => String(r.referee_user_id ?? "").trim())
      .filter(Boolean),
  );

  const periodRows = allRecent.filter((r) => inRange(r.created_at, from, to) && matchesProvider(r, provider) && matchesSearch(r, search));
  const prevRows = allRecent.filter((r) => inRange(r.created_at, prev.from, prev.to) && matchesProvider(r, provider) && matchesSearch(r, search));

  const userIds = periodRows.map((r) => String(r.auth_user_id ?? "").trim()).filter(Boolean);
  const profileOnboarding = new Map<string, boolean>();

  if (userIds.length > 0) {
    const { data: profiles } = await sb.from("profiles").select("id,onboarding_completed_at").in("id", userIds);
    for (const p of profiles ?? []) {
      const id = String((p as { id?: string }).id ?? "");
      const done = Boolean((p as { onboarding_completed_at?: string | null }).onboarding_completed_at);
      if (id) profileOnboarding.set(id, done);
    }
  }

  const onboardingDone = periodRows.filter((r) => profileOnboarding.get(String(r.auth_user_id)) === true).length;
  const onboardingRate = periodRows.length > 0 ? Math.round((onboardingDone / periodRows.length) * 100) : 0;

  const chartFrom =
    period === "today" || period === "yesterday"
      ? from
      : period === "7d"
        ? kstAddDays(kstStartOfDay(now), -6)
        : kstAddDays(kstStartOfDay(now), -29);

  const chartSource = allRecent.filter((r) => matchesProvider(r, provider) && matchesSearch(r, search));
  const dailyChart = buildDailyChart(chartSource, chartFrom, chartDayCount(period));

  const rows: AdminSignupRow[] = periodRows.map((r) => {
    const userId = String(r.auth_user_id ?? "");
    return {
      userId,
      provider: r.provider,
      providerLabel: PROVIDER_LABEL[r.provider] ?? r.provider,
      name: String(r.name ?? "").trim() || "—",
      email: String(r.email ?? "").trim() || "—",
      joinedAtIso: r.created_at,
      joinedAtLabel: fmtKstLabel(r.created_at),
      lastLoginAtIso: r.last_login_at,
      lastLoginAtLabel: fmtKstLabel(r.last_login_at),
      onboardingCompleted: profileOnboarding.get(userId) === true,
      referralSignup: referralSet.has(userId),
    };
  });

  return {
    period,
    provider,
    count: rows.length,
    kpis: {
      periodSignups: periodRows.length,
      periodSignupsPrev: prevRows.length,
      cumulativeTotal,
      onboardingRate,
      byProvider: countByProvider(periodRows),
      referralSignups: periodRows.filter((r) => referralSet.has(String(r.auth_user_id))).length,
    },
    dailyChart,
    rows,
  };
}

export function adminSignupsToCsv(payload: AdminSignupsPayload): string {
  const header = ["가입일시", "프로바이더", "이름", "이메일", "최근 로그인", "온보딩 완료", "초대 가입"];
  const lines = [header.join(",")];
  for (const row of payload.rows) {
    lines.push(
      [
        row.joinedAtLabel,
        row.providerLabel,
        csvCell(row.name),
        csvCell(row.email),
        row.lastLoginAtLabel,
        row.onboardingCompleted ? "Y" : "N",
        row.referralSignup ? "Y" : "N",
      ].join(","),
    );
  }
  return "\uFEFF" + lines.join("\n");
}

function csvCell(value: string): string {
  const v = value.replace(/"/g, '""');
  return `"${v}"`;
}
