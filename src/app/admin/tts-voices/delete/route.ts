import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }
  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  if (!id) return NextResponse.redirect(new URL("/admin#admin-tts-voices", request.url), 303);

  await supabaseServer().from("tts_voices").delete().eq("id", id);
  return NextResponse.redirect(new URL("/admin#admin-tts-voices", request.url), 303);
}
