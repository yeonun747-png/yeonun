import { NextResponse } from "next/server";

import { mapSessionApiError, sanitizeAuthErrorHint } from "@/lib/auth/auth-error-hint";
import { verifyExchangeToken } from "@/lib/auth/exchange-token";
import { mintSupabaseSessionTokens } from "@/lib/auth/mint-session";
import { hasActiveSocialUser } from "@/lib/auth/social-user-service";

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

  try {
    const active = await hasActiveSocialUser(payload.authUserId);
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
    const hint = sanitizeAuthErrorHint(e instanceof Error ? e.message : String(e));
    console.error("[api/auth/session]", { hint, error: e });
    return NextResponse.json(
      { ok: false, error: mapSessionApiError("session_failed"), hint: hint || "session_failed" },
      { status: 500 },
    );
  }
}
