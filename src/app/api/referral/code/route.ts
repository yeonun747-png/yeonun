import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { requireMyUserId } from "@/lib/my-route-auth";
import { ensureReferralCode } from "@/lib/referral-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  const serviceKey = env.supabaseServiceRoleKey;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  const supabase = createClient(env.supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const code = await ensureReferralCode(supabase, auth.userId);
    return NextResponse.json({ ok: true, code });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "code_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
