import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import type { CreditLedgerRow } from "@/lib/credit-server";
import { env } from "@/lib/env";
import {
  creditUsageCutoffIso,
  mapCreditUsageRow,
  type MyCreditUsageRow,
} from "@/lib/my-credit-usage";
import { resolveCreditUsageContext } from "@/lib/my-credit-usage-server";

export const dynamic = "force-dynamic";

export type MyCreditUsagePayload = {
  ok: true;
  rows: MyCreditUsageRow[];
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceKey = env.supabaseServiceRoleKey;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  const supabase = createClient(env.supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });
  }

  const uid = userData.user.id;
  const cutoff = creditUsageCutoffIso();

  const { data, error } = await supabase
    .from("user_credit_ledger")
    .select("*")
    .eq("user_id", uid)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.warn("[my/credit-usage]", error.message);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }

  const ledger = (data ?? []) as CreditLedgerRow[];
  const ctx = await resolveCreditUsageContext(ledger);
  const rows = ledger
    .map((row) => mapCreditUsageRow(row, ctx))
    .filter((row): row is MyCreditUsageRow => row !== null);

  const payload: MyCreditUsagePayload = { ok: true, rows };
  return NextResponse.json(payload);
}
