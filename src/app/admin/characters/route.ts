import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const key = String(form.get("key") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const han = String(form.get("han") ?? "").trim();
  const en = String(form.get("en") ?? "").trim();
  const spec = String(form.get("spec") ?? "").trim();
  const greeting = String(form.get("greeting") ?? "").trim();

  if (!key || !name || !han || !en || !spec || !greeting) {
    return NextResponse.redirect(new URL("/admin#content", request.url), 303);
  }

  const supabase = supabaseServer();
  await supabase.from("characters").upsert({ key, name, han, en, spec, greeting }, { onConflict: "key" });

  return NextResponse.redirect(new URL("/admin#content", request.url), 303);
}

