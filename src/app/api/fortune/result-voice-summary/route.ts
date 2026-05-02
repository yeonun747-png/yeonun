import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * fortune_results.voice_consult_summary 업데이트 — 서비스 롤만.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    result_id?: string;
    voice_consult_summary?: string;
  };

  const result_id = typeof body.result_id === "string" ? body.result_id.trim() : "";
  const voice_consult_summary =
    typeof body.voice_consult_summary === "string" ? body.voice_consult_summary.trim() : "";

  if (!UUID_RE.test(result_id)) {
    return NextResponse.json({ error: "invalid result_id" }, { status: 400 });
  }
  if (!voice_consult_summary) {
    return NextResponse.json({ error: "voice_consult_summary is required" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = supabaseServer();
  } catch {
    return NextResponse.json({ error: "server_storage_unconfigured" }, { status: 503 });
  }

  const { error } = await supabase
    .from("fortune_results")
    .update({ voice_consult_summary })
    .eq("id", result_id);

  if (error) {
    return NextResponse.json({ error: error.message, updated: false }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: true });
}
