import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const supabase = supabaseServer();

  const slug = String(form.get("slug") ?? "").trim();
  const category = String(form.get("category") ?? "notice").trim();
  const title = String(form.get("title") ?? "").trim();
  const published_on = String(form.get("published_on") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const sort_order = Number(String(form.get("sort_order") ?? "0").trim());
  const show_new_dot = String(form.get("show_new_dot") ?? "true") === "true";
  const is_published = String(form.get("is_published") ?? "true") === "true";

  if (!slug || !title || !published_on || !body) {
    return NextResponse.redirect(new URL("/admin#notices", request.url), 303);
  }

  const payload = {
    slug,
    category: category === "event" || category === "update" ? category : "notice",
    title,
    published_on,
    body,
    sort_order: Number.isFinite(sort_order) ? sort_order : 0,
    show_new_dot,
    is_published,
    updated_at: new Date().toISOString(),
  };

  await supabase.from("notices").upsert(payload, { onConflict: "slug" });
  return NextResponse.redirect(new URL("/admin#notices", request.url), 303);
}
