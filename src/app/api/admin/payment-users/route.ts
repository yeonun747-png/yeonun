import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import {
  loadAdminPaymentUsers,
  type AdminPaymentUsersPeriod,
} from "@/lib/admin-payment-users";

export const dynamic = "force-dynamic";

function parsePeriod(raw: string | null): AdminPaymentUsersPeriod {
  if (raw === "yesterday" || raw === "7d" || raw === "30d") return raw;
  return "today";
}

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const period = parsePeriod(new URL(request.url).searchParams.get("period"));

  try {
    const data = await loadAdminPaymentUsers(period);
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "load_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
