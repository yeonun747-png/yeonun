import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import {
  adminSignupsToCsv,
  loadAdminSignups,
  type AdminSignupProviderFilter,
  type AdminSignupsPeriod,
} from "@/lib/admin-signups";

export const dynamic = "force-dynamic";

function parsePeriod(raw: string | null): AdminSignupsPeriod {
  if (raw === "yesterday" || raw === "7d" || raw === "30d") return raw;
  return "today";
}

function parseProvider(raw: string | null): AdminSignupProviderFilter {
  if (raw === "google" || raw === "kakao" || raw === "naver") return raw;
  return "all";
}

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const provider = parseProvider(url.searchParams.get("provider"));
  const q = (url.searchParams.get("q") ?? "").trim();

  try {
    const data = await loadAdminSignups(period, provider, q);
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

  let body: { period?: string; provider?: string; q?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const period = parsePeriod(body.period ?? null);
  const provider = parseProvider(body.provider ?? null);
  const q = String(body.q ?? "").trim();

  try {
    const data = await loadAdminSignups(period, provider, q);
    const csv = adminSignupsToCsv(data);
    const filename = `yeonun-signups-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
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
