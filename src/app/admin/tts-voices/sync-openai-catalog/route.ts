import { NextResponse } from "next/server";

import { OPENAI_REALTIME_VOICE_CATALOG } from "@/lib/openai-realtime-voices";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = supabaseServer();
  const rows = OPENAI_REALTIME_VOICE_CATALOG.map((v) => ({
    provider: "openai_realtime",
    external_id: v.id,
    label: `${v.labelKo} — ${v.vibeKo}`,
    gender: v.gender,
    sort_order: v.sort_order,
    is_active: true,
  }));

  const { error } = await supabase.from("tts_voices").upsert(rows, { onConflict: "provider,external_id" });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.redirect(new URL("/admin#admin-tts-voices", request.url), 303);
}
