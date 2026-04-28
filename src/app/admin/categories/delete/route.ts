import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const slug = String(form.get("slug") ?? "").trim();
  if (!slug) return NextResponse.redirect(new URL("/admin#content", request.url));

  const supabase = supabaseServer();
  await supabase.from("categories").delete().eq("slug", slug);

  return NextResponse.redirect(new URL("/admin#content", request.url));
}

