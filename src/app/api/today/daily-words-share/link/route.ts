import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { isCarouselCharKey } from "@/lib/characters/character-carousel-static";
import { env } from "@/lib/env";
import { absoluteUrl } from "@/lib/site-url";
import {
  createDailyWordShareToken,
  DAILY_WORD_SHARE_MAX_QUOTE,
} from "@/lib/today-daily-word-share-token";

export const dynamic = "force-dynamic";

type Body = {
  character_key?: string;
  character_label?: string;
  quote?: string;
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
  const character_label = String(body.character_label ?? "").trim();
  const quote = String(body.quote ?? "").trim();
  const kst_date = String(body.kst_date ?? "").trim();

  if (!isCarouselCharKey(character_key)) {
    return NextResponse.json({ ok: false, error: "bad_character_key" }, { status: 400 });
  }
  if (!character_label) {
    return NextResponse.json({ ok: false, error: "bad_character_label" }, { status: 400 });
  }
  if (!quote || quote.length > DAILY_WORD_SHARE_MAX_QUOTE) {
    return NextResponse.json({ ok: false, error: "bad_quote" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(kst_date)) {
    return NextResponse.json({ ok: false, error: "bad_kst_date" }, { status: 400 });
  }

  try {
    const shareToken = createDailyWordShareToken({
      character_key,
      character_label,
      quote,
      kst_date,
    });
    const shareUrl = absoluteUrl(`/today/share/${shareToken}`);
    return NextResponse.json({ ok: true, shareUrl, shareToken });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "token_failed" }, { status: 500 });
  }
}
