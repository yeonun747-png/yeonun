import { NextResponse } from "next/server";

import { bearerFromRequest, supabaseRouteUserClient } from "@/lib/supabase/route-user-client";

export async function requireMyUserId(
  request: Request,
): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const token = bearerFromRequest(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    };
  }

  const sbUser = supabaseRouteUserClient(token);
  if (!sbUser) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 503 }),
    };
  }

  const { data: userData, error: userErr } = await sbUser.auth.getUser();
  if (userErr || !userData.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 }),
    };
  }

  return { ok: true, userId: userData.user.id };
}

/** Bearer JWT가 있으면 uid, 없으면 null (비로그인 저장용) */
export async function optionalMyUserId(request: Request): Promise<string | null> {
  const token = bearerFromRequest(request);
  if (!token) return null;
  const sbUser = supabaseRouteUserClient(token);
  if (!sbUser) return null;
  const { data: userData } = await sbUser.auth.getUser();
  return userData.user?.id ?? null;
}
