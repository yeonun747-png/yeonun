import { resolveAdminPaymentUsersRange, type AdminPaymentUsersPeriod } from "@/lib/admin-payment-users";
import {
  formatGuestVisitorLabel,
  labelForVisitPath,
  normalizeVisitPath,
  providerLabel,
} from "@/lib/admin-visit-path-label";
import { getKstParts, kstAddDays } from "@/lib/datetime/kst";
import { supabaseServer } from "@/lib/supabase/server";

export type AdminVisitorsPeriod = AdminPaymentUsersPeriod;
export type AdminVisitorsTab = "views" | "unique";

export type AdminVisitorStats = {
  pageViews: number;
  uniqueVisitors: number;
};

export type AdminVisitorDailyPoint = {
  label: string;
  pageViews: number;
  uniqueVisitors: number;
};

export type AdminVisitorPathRank = {
  path: string;
  pathLabel: string;
  count: number;
  pct: number;
};

export type AdminVisitorPathDetail = {
  path: string;
  pathLabel: string;
  count: number;
};

export type AdminUniqueVisitorRow = {
  displayName: string;
  subLabel: string;
  visitorType: "member" | "guest";
  userId: string | null;
  pageViews: number;
  firstAtLabel: string;
  lastAtLabel: string;
  pathsSummary: string;
  pathDetails: AdminVisitorPathDetail[];
};

export type AdminVisitorEventRow = {
  id: string;
  atIso: string;
  atLabel: string;
  path: string;
  pathLabel: string;
  visitorLabel: string;
  visitorSubLabel: string;
  visitorType: "member" | "guest";
  userId: string | null;
};

export type AdminVisitorsPayload = {
  period: AdminVisitorsPeriod;
  tab: AdminVisitorsTab;
  count: number;
  page: number;
  pageSize: number;
  kpis: {
    pageViews: number;
    uniqueVisitors: number;
    avgPageViewsPerVisitor: number;
    memberEvents: number;
    guestEvents: number;
    memberUnique: number;
    guestUnique: number;
  };
  dailyChart: AdminVisitorDailyPoint[];
  pathRank: AdminVisitorPathRank[];
  uniqueRows: AdminUniqueVisitorRow[];
  rows: AdminVisitorEventRow[];
};

type VisitRow = {
  id: string;
  visitor_ref: string;
  path: string;
  created_at: string;
};

type VisitorIdentity = {
  displayName: string;
  subLabel: string;
  visitorType: "member" | "guest";
  userId: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 50;

function pad2(n: number) {
  return String(Math.trunc(n)).padStart(2, "0");
}

function inRange(iso: string, from: Date, to: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
}

function fmtKstLabel(iso: string): string {
  const { year, month, day, hour, minute, second } = getKstParts(new Date(iso));
  return `${year}.${pad2(month)}.${pad2(day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}

function fmtChartLabel(d: Date): string {
  const { month, day } = getKstParts(d);
  return `${pad2(month)}/${pad2(day)}`;
}

function isMemberRef(ref: string): boolean {
  return UUID_RE.test(ref);
}

function chartDayCount(period: AdminVisitorsPeriod): number {
  if (period === "today" || period === "yesterday") return 1;
  if (period === "7d") return 7;
  return 30;
}

async function fetchVisitRows(from: Date, to: Date): Promise<VisitRow[]> {
  const sb = supabaseServer();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const { data, error } = await sb
    .from("site_visit_events")
    .select("id, visitor_ref, path, created_at")
    .gte("created_at", fromIso)
    .lt("created_at", toIso)
    .order("created_at", { ascending: false })
    .limit(100000);

  if (error) throw new Error(error.message);
  return (data ?? []) as VisitRow[];
}

async function resolveMemberLabels(
  userIds: string[],
): Promise<Map<string, { name: string; email: string; provider: string | null }>> {
  const map = new Map<string, { name: string; email: string; provider: string | null }>();
  if (userIds.length === 0) return map;

  const sb = supabaseServer();
  const [socialRes, profileRes] = await Promise.all([
    sb
      .from("yeonun_social_users")
      .select("auth_user_id,provider,name,email")
      .in("auth_user_id", userIds)
      .is("deleted_at", null),
    sb.from("profiles").select("id,display_name").in("id", userIds),
  ]);

  const profileNames = new Map<string, string>();
  for (const p of profileRes.data ?? []) {
    const id = String((p as { id?: string }).id ?? "");
    const name = String((p as { display_name?: string | null }).display_name ?? "").trim();
    if (id && name) profileNames.set(id, name);
  }

  for (const row of socialRes.data ?? []) {
    const uid = String((row as { auth_user_id?: string }).auth_user_id ?? "");
    if (!uid) continue;
    const socialName = String((row as { name?: string | null }).name ?? "").trim();
    const profileName = profileNames.get(uid) ?? "";
    map.set(uid, {
      name: profileName || socialName || "회원",
      email: String((row as { email?: string | null }).email ?? "").trim(),
      provider: String((row as { provider?: string | null }).provider ?? "").trim() || null,
    });
  }

  for (const uid of userIds) {
    if (map.has(uid)) continue;
    map.set(uid, {
      name: profileNames.get(uid) || "회원",
      email: "",
      provider: null,
    });
  }

  return map;
}

async function resolveVisitorIdentities(refs: string[]): Promise<Map<string, VisitorIdentity>> {
  const uniqueRefs = [...new Set(refs.map((r) => String(r ?? "").trim()).filter(Boolean))];
  const map = new Map<string, VisitorIdentity>();
  const memberIds = uniqueRefs.filter(isMemberRef);
  const memberInfo = await resolveMemberLabels(memberIds);

  for (const ref of uniqueRefs) {
    if (isMemberRef(ref)) {
      const info = memberInfo.get(ref);
      const name = info?.name || "회원";
      const provider = providerLabel(info?.provider);
      const subParts = [info?.email, provider].filter(Boolean);
      map.set(ref, {
        displayName: name,
        subLabel: subParts.length > 0 ? subParts.join(" · ") : "로그인 회원",
        visitorType: "member",
        userId: ref,
      });
      continue;
    }

    map.set(ref, {
      displayName: formatGuestVisitorLabel(ref),
      subLabel: "비로그인 방문",
      visitorType: "guest",
      userId: null,
    });
  }

  return map;
}

function buildDailyChart(rows: VisitRow[], from: Date, days: number): AdminVisitorDailyPoint[] {
  const points: AdminVisitorDailyPoint[] = [];
  for (let i = 0; i < days; i++) {
    const dayStart = kstAddDays(from, i);
    const dayEnd = kstAddDays(dayStart, 1);
    const dayRows = rows.filter((r) => inRange(r.created_at, dayStart, dayEnd));
    const refs = new Set<string>();
    for (const r of dayRows) {
      const ref = String(r.visitor_ref ?? "").trim();
      if (ref) refs.add(ref);
    }
    points.push({
      label: fmtChartLabel(dayStart),
      pageViews: dayRows.length,
      uniqueVisitors: refs.size,
    });
  }
  return points;
}

function buildPathRank(rows: VisitRow[]): AdminVisitorPathRank[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const path = normalizeVisitPath(r.path);
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  const total = rows.length || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({
      path,
      pathLabel: labelForVisitPath(path),
      count,
      pct: Math.round((count / total) * 100),
    }));
}

function buildKpis(rows: VisitRow[]): AdminVisitorsPayload["kpis"] {
  const refs = new Set<string>();
  const memberRefs = new Set<string>();
  const guestRefs = new Set<string>();
  let memberEvents = 0;
  let guestEvents = 0;

  for (const r of rows) {
    const ref = String(r.visitor_ref ?? "").trim();
    if (!ref) continue;
    refs.add(ref);
    if (isMemberRef(ref)) {
      memberEvents += 1;
      memberRefs.add(ref);
    } else {
      guestEvents += 1;
      guestRefs.add(ref);
    }
  }

  const pageViews = rows.length;
  const uniqueVisitors = refs.size;

  return {
    pageViews,
    uniqueVisitors,
    avgPageViewsPerVisitor: uniqueVisitors > 0 ? Math.round((pageViews / uniqueVisitors) * 10) / 10 : 0,
    memberEvents,
    guestEvents,
    memberUnique: memberRefs.size,
    guestUnique: guestRefs.size,
  };
}

function buildPathDetailsForEvents(events: VisitRow[]): AdminVisitorPathDetail[] {
  const pathCounts = new Map<string, number>();
  for (const e of events) {
    const path = normalizeVisitPath(e.path);
    pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);
  }
  return [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([path, count]) => ({
      path,
      pathLabel: labelForVisitPath(path),
      count,
    }));
}

function buildUniqueVisitorRows(rows: VisitRow[], identities: Map<string, VisitorIdentity>): AdminUniqueVisitorRow[] {
  const groups = new Map<string, VisitRow[]>();
  for (const r of rows) {
    const ref = String(r.visitor_ref ?? "").trim();
    if (!ref) continue;
    const list = groups.get(ref) ?? [];
    list.push(r);
    groups.set(ref, list);
  }

  const result = [...groups.entries()].map(([ref, events]) => {
    const identity = identities.get(ref) ?? {
      displayName: "—",
      subLabel: "—",
      visitorType: "guest" as const,
      userId: null,
    };
    const pathDetails = buildPathDetailsForEvents(events);
    const sortedAsc = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const sortedDesc = [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      displayName: identity.displayName,
      subLabel: identity.subLabel,
      visitorType: identity.visitorType,
      userId: identity.userId,
      pageViews: events.length,
      firstAtLabel: fmtKstLabel(sortedAsc[0]?.created_at ?? ""),
      lastAtLabel: fmtKstLabel(sortedDesc[0]?.created_at ?? ""),
      pathsSummary: pathDetails
        .slice(0, 4)
        .map((p) => p.pathLabel)
        .join(", "),
      pathDetails,
    };
  });

  return result.sort((a, b) => b.pageViews - a.pageViews || a.displayName.localeCompare(b.displayName, "ko"));
}

function toEventRows(rows: VisitRow[], identities: Map<string, VisitorIdentity>): AdminVisitorEventRow[] {
  return rows.map((r) => {
    const ref = String(r.visitor_ref ?? "").trim();
    const identity = identities.get(ref) ?? {
      displayName: ref ? formatGuestVisitorLabel(ref) : "—",
      subLabel: "—",
      visitorType: isMemberRef(ref) ? ("member" as const) : ("guest" as const),
      userId: isMemberRef(ref) ? ref : null,
    };
    const path = normalizeVisitPath(r.path);
    return {
      id: r.id,
      atIso: r.created_at,
      atLabel: fmtKstLabel(r.created_at),
      path,
      pathLabel: labelForVisitPath(path),
      visitorLabel: identity.displayName,
      visitorSubLabel: identity.subLabel,
      visitorType: identity.visitorType,
      userId: identity.userId,
    };
  });
}

function matchesPathFilter(row: VisitRow, pathQ: string): boolean {
  if (!pathQ) return true;
  const needle = pathQ.toLowerCase();
  const path = normalizeVisitPath(row.path);
  const label = labelForVisitPath(path).toLowerCase();
  return path.toLowerCase().includes(needle) || label.includes(needle);
}

export async function loadAdminVisitorStats(period: AdminVisitorsPeriod): Promise<AdminVisitorStats> {
  const { from, to } = resolveAdminPaymentUsersRange(period);
  const rows = await fetchVisitRows(from, to);
  const kpis = buildKpis(rows);
  return { pageViews: kpis.pageViews, uniqueVisitors: kpis.uniqueVisitors };
}

export async function loadAdminVisitors(
  period: AdminVisitorsPeriod,
  tab: AdminVisitorsTab = "views",
  page = 1,
  pathQ = "",
): Promise<AdminVisitorsPayload> {
  const { from, to } = resolveAdminPaymentUsersRange(period);
  const allRows = await fetchVisitRows(from, to);
  const filtered = pathQ ? allRows.filter((r) => matchesPathFilter(r, pathQ)) : allRows;
  const refs = filtered.map((r) => String(r.visitor_ref ?? "").trim()).filter(Boolean);
  const identities = await resolveVisitorIdentities(refs);
  const kpis = buildKpis(filtered);
  const days = chartDayCount(period);
  const dailyChart = buildDailyChart(filtered, from, days);
  const pathRank = buildPathRank(filtered);
  const uniqueRows = buildUniqueVisitorRows(filtered, identities);
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  return {
    period,
    tab,
    count: filtered.length,
    page: safePage,
    pageSize: PAGE_SIZE,
    kpis,
    dailyChart,
    pathRank,
    uniqueRows,
    rows: toEventRows(pageRows, identities),
  };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function adminVisitorsToCsv(rows: AdminVisitorEventRow[]): string {
  const header = "시각,방문자,방문자 정보,페이지,경로,유형";
  const lines = rows.map((r) =>
    [
      csvEscape(r.atLabel),
      csvEscape(r.visitorLabel),
      csvEscape(r.visitorSubLabel),
      csvEscape(r.pathLabel),
      csvEscape(r.path),
      csvEscape(r.visitorType === "member" ? "회원" : "비회원"),
    ].join(","),
  );
  return `\uFEFF${header}\n${lines.join("\n")}\n`;
}

export async function loadAdminVisitorsForExport(
  period: AdminVisitorsPeriod,
  pathQ = "",
): Promise<AdminVisitorEventRow[]> {
  const { from, to } = resolveAdminPaymentUsersRange(period);
  const allRows = await fetchVisitRows(from, to);
  const filtered = pathQ ? allRows.filter((r) => matchesPathFilter(r, pathQ)) : allRows;
  const refs = filtered.map((r) => String(r.visitor_ref ?? "").trim()).filter(Boolean);
  const identities = await resolveVisitorIdentities(refs);
  return toEventRows(filtered, identities);
}
