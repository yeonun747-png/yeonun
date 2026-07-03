import { resolveAdminPaymentUsersRange, type AdminPaymentUsersPeriod } from "@/lib/admin-payment-users";
import { supabaseServer } from "@/lib/supabase/server";

export type AdminVisitorStats = {
  pageViews: number;
  uniqueVisitors: number;
};

export async function loadAdminVisitorStats(period: AdminPaymentUsersPeriod): Promise<AdminVisitorStats> {
  const { from, to } = resolveAdminPaymentUsersRange(period);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const sb = supabaseServer();

  const [countRes, refsRes] = await Promise.all([
    sb
      .from("site_visit_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", fromIso)
      .lt("created_at", toIso),
    sb
      .from("site_visit_events")
      .select("visitor_ref")
      .gte("created_at", fromIso)
      .lt("created_at", toIso)
      .limit(100000),
  ]);

  if (countRes.error) throw new Error(countRes.error.message);
  if (refsRes.error) throw new Error(refsRes.error.message);

  const refs = new Set<string>();
  for (const row of refsRes.data ?? []) {
    const ref = String((row as { visitor_ref?: string }).visitor_ref ?? "").trim();
    if (ref) refs.add(ref);
  }

  return {
    pageViews: countRes.count ?? 0,
    uniqueVisitors: refs.size,
  };
}
