import { NextResponse } from "next/server";

import { revalidateReviewPages } from "@/lib/reviews-revalidate";
import { supabaseServer } from "@/lib/supabase/server";

function normalizeCharacterKey(raw: string | null | undefined): string {
  if (raw === "yeo" || raw === "un" || raw === "byeol") return raw;
  return "yeon";
}

function wantsJson(form: FormData, request: Request): boolean {
  return (
    String(form.get("ajax") ?? "") === "1" ||
    request.headers.get("accept")?.includes("application/json") === true
  );
}

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
  const is_showcase = String(form.get("is_showcase") ?? "false") === "true";
  const is_published = String(form.get("is_published") ?? "false") === "true";
  const json = wantsJson(form, request);

  if (!product_slug || !user_mask || !body || !Number.isFinite(stars)) {
    if (json) return NextResponse.json({ ok: false, error: "invalid_params" }, { status: 400 });
    return NextResponse.redirect(new URL("/admin#reviews", request.url), 303);
  }

  const supabase = supabaseServer();

  const { data: product } = await supabase
    .from("products")
    .select("title,character_key")
    .eq("slug", product_slug)
    .maybeSingle();

  const payload = {
    product_slug,
    user_mask,
    stars: Math.max(1, Math.min(5, Math.round(stars))),
    body,
    tags,
    is_showcase,
    is_published,
    character_key: normalizeCharacterKey(product?.character_key),
    product_label: String(product?.title ?? "").trim() || product_slug,
    reviewed_on: new Date().toISOString().slice(0, 10),
  };

  if (id) {
    const { reviewed_on: _drop, ...updatePayload } = payload;
    const { error } = await supabase.from("reviews").update(updatePayload).eq("id", id);
    if (error) {
      if (json) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.redirect(new URL("/admin#reviews", request.url), 303);
    }
  } else {
    const { error } = await supabase.from("reviews").insert(payload);
    if (error) {
      if (json) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.redirect(new URL("/admin#reviews", request.url), 303);
    }
  }

  revalidateReviewPages();

  if (json) return NextResponse.json({ ok: true });

  return NextResponse.redirect(new URL("/admin#reviews", request.url), 303);
}
