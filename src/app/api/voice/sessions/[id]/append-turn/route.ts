import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  role?: string;
  text?: string;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "missing_session" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const role = String(body.role ?? "").trim();
  const text = String(body.text ?? "").trim().slice(0, 12000);

  if (role !== "user" && role !== "assistant") {
    return NextResponse.json({ ok: false, error: "invalid_role" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ ok: false, error: "empty_text" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("voice_turns").insert({
    session_id: sessionId,
    role,
    text,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true as const });
}
