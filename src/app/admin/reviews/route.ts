import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  const product_slug = String(form.get("product_slug") ?? "").trim();
  const user_mask = String(form.get("user_mask") ?? "").trim();
  const stars = Number(String(form.get("stars") ?? "5").trim());
  const body = String(form.get("body") ?? "").trim();
  const tags = String(form.get("tags") ?? "")
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (!product_slug || !user_mask || !body || !Number.isFinite(stars)) {
    return NextResponse.redirect(new URL("/admin#content", request.url), 303);
  }

  const supabase = supabaseServer();
  const payload = { product_slug, user_mask, stars: Math.max(1, Math.min(5, Math.round(stars))), body, tags };

  if (id) {
    await supabase.from("reviews").update(payload).eq("id", id);
  } else {
    await supabase.from("reviews").insert(payload);
  }

  return NextResponse.redirect(new URL("/admin#content", request.url), 303);
}

