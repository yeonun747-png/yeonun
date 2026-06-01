import { NextResponse } from "next/server";

import { bearerFromRequest } from "@/lib/supabase/route-user-client";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** 카카오 탈퇴 연결 끊기 — 카카오 개발자 콘솔 Admin 키 */
async function kakaoUnlinkUser(providerId: string): Promise<void> {
  const adminKey = String(process.env.KAKAO_ADMIN_KEY ?? "").trim();
  if (!adminKey) {
    console.warn("[delete-account] KAKAO_ADMIN_KEY missing — skip Kakao unlink");
    return;
  }
  const body = new URLSearchParams({
    target_id_type: "user_id",
    target_id: String(providerId),
  });
  const res = await fetch("https://kapi.kakao.com/v1/user/unlink", {
    method: "POST",
    headers: {
      Authorization: `KakaoAK ${adminKey}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.warn("[delete-account] kakao unlink failed", res.status, t.slice(0, 500));
  }
}

export async function POST(request: Request) {
  const token = bearerFromRequest(request);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let sb;
  try {
    sb = supabaseServer();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser(token);
  if (userErr || !user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  const uid = user.id;

  const { data: socialRows, error: socErr } = await sb
    .from("yeonun_social_users")
    .select("provider, provider_id")
    .eq("auth_user_id", uid)
    .is("deleted_at", null);

  if (socErr) return NextResponse.json({ error: socErr.message }, { status: 500 });

  for (const row of socialRows ?? []) {
    if (row.provider === "kakao" && row.provider_id) {
      await kakaoUnlinkUser(String(row.provider_id));
    }
  }

  const purgeAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const deletedAt = new Date().toISOString();

  const { error: softErr } = await sb
    .from("yeonun_social_users")
    .update({ deleted_at: deletedAt, purge_after_at: purgeAfter })
    .eq("auth_user_id", uid);

  if (softErr) return NextResponse.json({ error: softErr.message }, { status: 500 });

  const purgedRef = `purged_${uid.slice(0, 8)}_${Date.now().toString(36)}`;
  await sb
    .from("profiles")
    .update({
      display_name: "탈퇴회원",
      birth_year: null,
      birth_month: null,
      birth_day: null,
      birth_branch_key: null,
      birth_minute: null,
      birth_time_unknown: true,
      gender: null,
    })
    .eq("id", uid);

  await sb.from("fortune_requests").update({ user_ref: purgedRef }).eq("user_ref", uid);
  await sb.from("voice_sessions").update({ user_ref: purgedRef }).eq("user_ref", uid);
  await sb.from("text_chat_sessions").update({ user_ref: purgedRef }).eq("user_ref", uid);

  return NextResponse.json({ ok: true });
}
