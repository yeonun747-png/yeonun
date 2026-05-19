import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { requireMyUserId } from "@/lib/my-route-auth";
import { claimReferralSignup } from "@/lib/referral-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    assigned_kst_date?: string;
  };

  const code = String(body.code ?? "").trim();
  const assigned = String(body.assigned_kst_date ?? "").trim();
  if (!code || !/^\d{4}-\d{2}-\d{2}$/.test(assigned)) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const serviceKey = env.supabaseServiceRoleKey;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  const supabase = createClient(env.supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await claimReferralSignup(supabase, auth.userId, code, assigned, {
      requireNewSignup: true,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason ?? "claim_failed" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "claim_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
