import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { isCreditPackageProductSlug } from "@/lib/credit-package-products";
import { invalidateFortunePromptCache } from "@/lib/data/fortune-prompt-cache";
import { supabaseServer } from "@/lib/supabase/server";
import { emptyFortuneMenu, parseFortuneMenuJson } from "@/lib/product-fortune-menu";
import { parseFortuneQuestionsJsonFromForm } from "@/lib/product-fortune-questions";

function wantsJson(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json")) return true;
  if (request.headers.get("x-admin-fetch") === "1") return true;
  return false;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const json = wantsJson(request);

  if (!(await isAdminRequest())) {
    if (json) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

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
  const strategyRaw = String(form.get("fortune_stream_strategy") ?? "hybrid").trim();
  const fortune_stream_strategy = strategyRaw === "hybrid" ? "hybrid" : "claude_only";
  const saju_input_profile = String(form.get("saju_input_profile") ?? "single").trim() === "pair" ? "pair" : "single";

  const fortuneMenuRaw = String(form.get("fortune_menu_json") ?? "").trim();
  let fortune_menu = emptyFortuneMenu();
  if (fortuneMenuRaw.length) {
    try {
      fortune_menu = parseFortuneMenuJson(JSON.parse(fortuneMenuRaw) as unknown);
    } catch {
      if (json) return NextResponse.json({ ok: false, error: "fortune_menu_json 파싱 실패" }, { status: 400 });
      return NextResponse.redirect(new URL("/admin", request.url), 303);
    }
  }

  const fortuneQuestionsRaw = String(form.get("fortune_questions_json") ?? "").trim();
  let fortune_questions: ReturnType<typeof parseFortuneQuestionsJsonFromForm> = null;
  if (fortuneQuestionsRaw.length) {
    try {
      fortune_questions = parseFortuneQuestionsJsonFromForm(fortuneQuestionsRaw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fortune_questions_json 파싱 실패";
      if (json) return NextResponse.json({ ok: false, error: msg }, { status: 400 });
      return NextResponse.redirect(new URL("/admin", request.url), 303);
    }
  }

  if (!slug || !title || !quote || !category_slug || !character_key || !Number.isFinite(price_krw)) {
    if (json) return NextResponse.json({ ok: false, error: "필수 필드 누락" }, { status: 400 });
    return NextResponse.redirect(new URL("/admin", request.url), 303);
  }

  if (isCreditPackageProductSlug(slug)) {
    const err = "크레딧 충전 패키지 slug(credit-package-*)는 어드민에서 등록할 수 없습니다.";
    if (json) return NextResponse.json({ ok: false, error: err }, { status: 400 });
    return NextResponse.redirect(new URL("/admin#admin-products", request.url), 303);
  }

  const supabase = supabaseServer();
  const { data: prev } = await supabase.from("products").select("payment_code").eq("slug", slug).maybeSingle();

  const payload: Record<string, unknown> = {
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
    fortune_menu,
    fortune_questions,
    fortune_stream_strategy,
  };

  if (prev?.payment_code != null && prev.payment_code !== "") {
    payload.payment_code = Number(prev.payment_code);
  }

  const { error } = await supabase.from("products").upsert(payload);
  if (error) {
    if (json) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.redirect(new URL("/admin", request.url), 303);
  }
  invalidateFortunePromptCache();

  const { data: after } = await supabase.from("products").select("payment_code").eq("slug", slug).maybeSingle();
  const payment_code = after?.payment_code != null && after.payment_code !== "" ? Number(after.payment_code) : null;

  if (json) {
    return NextResponse.json({ ok: true, slug, payment_code });
  }
  return NextResponse.redirect(new URL("/admin#admin-products", request.url), 303);
}
