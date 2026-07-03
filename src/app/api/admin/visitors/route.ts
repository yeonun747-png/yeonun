import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { loadAdminVisitorStats } from "@/lib/admin-visitor-stats";
import type { AdminDashboardPeriod } from "@/lib/admin-dashboard-data";

export const dynamic = "force-dynamic";

function parsePeriod(raw: string | null): AdminDashboardPeriod {
  if (raw === "yesterday" || raw === "7d" || raw === "30d") return raw;
  return "today";
}

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const period = parsePeriod(new URL(request.url).searchParams.get("period"));

  try {
    const visitors = await loadAdminVisitorStats(period);
    return NextResponse.json({ ok: true, period, ...visitors });
  } catch (e) {
    const message = e instanceof Error ? e.message : "load_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
