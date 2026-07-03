import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import {
  adminVisitorsToCsv,
  loadAdminVisitorStats,
  loadAdminVisitors,
  loadAdminVisitorsForExport,
  type AdminVisitorsPeriod,
  type AdminVisitorsTab,
} from "@/lib/admin-visitors";

export const dynamic = "force-dynamic";

function parsePeriod(raw: string | null): AdminVisitorsPeriod {
  if (raw === "yesterday" || raw === "7d" || raw === "30d") return raw;
  return "today";
}

function parseTab(raw: string | null): AdminVisitorsTab {
  return raw === "unique" ? "unique" : "views";
}

function parsePage(raw: string | null): number {
  const n = Number(raw ?? "1");
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const mode = url.searchParams.get("mode");

  if (mode === "summary") {
    try {
      const visitors = await loadAdminVisitorStats(period);
      return NextResponse.json({ ok: true, period, ...visitors });
    } catch (e) {
      const message = e instanceof Error ? e.message : "load_failed";
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }

  const tab = parseTab(url.searchParams.get("tab"));
  const page = parsePage(url.searchParams.get("page"));
  const pathQ = (url.searchParams.get("path") ?? "").trim();

  try {
    const data = await loadAdminVisitors(period, tab, page, pathQ);
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "load_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { period?: string; path?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const period = parsePeriod(body.period ?? null);
  const pathQ = String(body.path ?? "").trim();

  try {
    const rows = await loadAdminVisitorsForExport(period, pathQ);
    const csv = adminVisitorsToCsv(rows);
    const filename = `yeonun-visitors-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "export_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
