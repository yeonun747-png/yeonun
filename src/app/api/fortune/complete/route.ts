import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    request_id?: string;
    html?: string;
    summary?: string;
    raw_stream_url?: string;
    status?: string;
  };

  if (!body.request_id || body.html == null) {
    return NextResponse.json({ error: "request_id and html are required" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const status = body.status || "completed";

  const { data, error } = await supabase
    .from("fortune_results")
    .insert({
      request_id: body.request_id,
      status,
      html: body.html,
      summary: body.summary ?? null,
      raw_stream_url: body.raw_stream_url ?? null,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("fortune_requests")
    .update({ status })
    .eq("id", body.request_id);

  return NextResponse.json({ success: true, id: data?.id });
}

