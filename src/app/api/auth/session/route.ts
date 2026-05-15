import { NextResponse } from "next/server";

import { verifyExchangeToken } from "@/lib/auth/exchange-token";
import { mintSupabaseSessionTokens } from "@/lib/auth/mint-session";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let token = "";
  try {
    const body = (await request.json()) as { token?: string };
    token = String(body?.token ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const payload = verifyExchangeToken(token);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  let sb;
  try {
    sb = supabaseServer();
  } catch {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  try {
    const { data: active } = await sb
      .from("yeonun_social_users")
      .select("id")
      .eq("auth_user_id", payload.authUserId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!active) {
      return NextResponse.json({ ok: false, error: "account_withdrawn" }, { status: 403 });
    }

    const session = await mintSupabaseSessionTokens(payload.email);
    return NextResponse.json({
      ok: true,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      is_new_user: payload.isNewUser,
    });
  } catch (e) {
    console.error("[api/auth/session]", e);
    return NextResponse.json({ ok: false, error: "session_failed" }, { status: 500 });
  }
}
