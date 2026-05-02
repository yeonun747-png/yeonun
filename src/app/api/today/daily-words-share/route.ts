import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

type Body = {
  character_key?: string;
  channel?: string;
  kst_date?: string;
};

export async function POST(request: Request) {
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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const character_key = String(body.character_key ?? "").trim();
  const channel = String(body.channel ?? "").trim();
  const kst_date = String(body.kst_date ?? "").trim();

  if (!["yeon", "byeol", "yeo", "un"].includes(character_key)) {
    return NextResponse.json({ ok: false, error: "bad_character_key" }, { status: 400 });
  }
  if (channel !== "native" && channel !== "clipboard") {
    return NextResponse.json({ ok: false, error: "bad_channel" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(kst_date)) {
    return NextResponse.json({ ok: false, error: "bad_kst_date" }, { status: 400 });
  }

  const { error: insErr } = await supabase.from("share_logs").insert({
    user_id: userData.user.id,
    kst_date,
    character_key,
    channel,
  });

  if (insErr) {
    console.warn("[daily-words-share]", insErr.message);
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
