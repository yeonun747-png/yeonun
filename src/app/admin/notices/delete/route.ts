import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const slug = String(form.get("slug") ?? "").trim();
  if (slug) {
    const supabase = supabaseServer();
    await supabase.from("notices").delete().eq("slug", slug);
  }
  return NextResponse.redirect(new URL("/admin#notices", request.url), 303);
}
