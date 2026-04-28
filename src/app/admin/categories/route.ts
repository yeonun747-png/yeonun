import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const slug = String(form.get("slug") ?? "").trim();
  const label = String(form.get("label") ?? "").trim();
  const sort_order = Number(String(form.get("sort_order") ?? "0").trim());

  if (!slug || !label || !Number.isFinite(sort_order)) {
    return NextResponse.redirect(new URL("/admin#content", request.url));
  }

  const supabase = supabaseServer();
  await supabase.from("categories").upsert({ slug, label, sort_order }, { onConflict: "slug" });

  return NextResponse.redirect(new URL("/admin#content", request.url));
}

