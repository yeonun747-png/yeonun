import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** 수동 POST(x-cron-secret) · Vercel Cron GET(Authorization Bearer) 모두 허용 */
function verifyCronSecret(request: Request): boolean {
  const secret = String(process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  if ((request.headers.get("x-cron-secret") ?? "") === secret) return true;
  const auth = (request.headers.get("authorization") ?? "").trim();
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return Boolean(m && m[1].trim() === secret);
}

async function purgeDeletedAccounts(): Promise<NextResponse> {
  let sb;
  try {
    sb = supabaseServer();
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const nowIso = new Date().toISOString();

  const { data: rows, error: qErr } = await sb
    .from("yeonun_social_users")
    .select("auth_user_id")
    .not("deleted_at", "is", null)
    .lte("purge_after_at", nowIso);

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  const ids = [...new Set((rows ?? []).map((r) => String(r.auth_user_id)).filter(Boolean))];
  let purged = 0;

  for (const uid of ids) {
    const { error: delErr } = await sb.auth.admin.deleteUser(uid);
    if (!delErr) purged += 1;
  }

  return NextResponse.json({ ok: true, candidates: ids.length, purged });
}

/** Vercel Cron 기본 호출 방식 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return purgeDeletedAccounts();
}

/** 수동·외부 스케줄러 POST */
export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return purgeDeletedAccounts();
}
