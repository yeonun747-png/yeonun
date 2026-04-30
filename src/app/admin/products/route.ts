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
  const homeSectionRaw = String(form.get("home_section_slug") ?? "").trim();
  const home_section_slug = homeSectionRaw.length ? homeSectionRaw : null;
  const tagsRaw = String(form.get("tags") ?? "").trim();
  const tags = tagsRaw.length
    ? tagsRaw
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (s.startsWith("#") ? s : `#${s}`))
    : [];
  const thumbnail_svg_raw = String(form.get("thumbnail_svg") ?? "");
  const thumbnail_svg = thumbnail_svg_raw.trim().length ? thumbnail_svg_raw : null;
  const profileRaw = String(form.get("saju_input_profile") ?? "single").trim();
  const saju_input_profile = profileRaw === "pair" ? "pair" : "single";

  if (!slug || !title || !quote || !category_slug || !character_key || !Number.isFinite(price_krw)) {
    return NextResponse.redirect(new URL("/admin", request.url), 303);
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
    home_section_slug,
    tags,
    thumbnail_svg,
    saju_input_profile,
  });

  return NextResponse.redirect(new URL("/admin", request.url), 303);
}

