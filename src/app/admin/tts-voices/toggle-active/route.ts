import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  const is_active = String(form.get("is_active") ?? "true") === "true";

  if (!id) return NextResponse.redirect(new URL("/admin#admin-tts-voices", request.url), 303);

  await supabaseServer().from("tts_voices").update({ is_active }).eq("id", id);
  return NextResponse.redirect(new URL("/admin#admin-tts-voices", request.url), 303);
}

