import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();

  const slug = String(form.get("slug") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const quote = String(form.get("quote") ?? "").trim();
  const category_slug = String(form.get("category_slug") ?? "").trim();
  const character_key = String(form.get("character_key") ?? "").trim();
  const badgeRaw = String(form.get("badge") ?? "").trim();
  const price_krw = Number(String(form.get("price_krw") ?? "0").trim());

  if (!slug || !title || !quote || !category_slug || !character_key || !Number.isFinite(price_krw)) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  const supabase = supabaseServer();
  await supabase.from("products").upsert({
    slug,
    title,
    quote,
    category_slug,
    character_key,
    badge: badgeRaw.length ? badgeRaw : null,
    price_krw,
  });

  return NextResponse.redirect(new URL("/admin", request.url));
}

