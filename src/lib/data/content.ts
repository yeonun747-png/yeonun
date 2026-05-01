import { supabaseServer } from "@/lib/supabase/server";
import { parseFortuneMenuJson, type FortuneMenuPayload } from "@/lib/product-fortune-menu";
import { cache } from "react";

export type Category = {
  slug: string;
  label: string;
  sort_order: number;
};

export type SajuInputProfile = "single" | "pair";

export type Product = {
  slug: string;
  title: string;
  quote: string;
  category_slug: string;
  badge: string | null;
  price_krw: number;
  character_key: string;
  home_section_slug: string | null;
  tags: string[];
  thumbnail_svg: string | null;
  saju_input_profile: SajuInputProfile;
  /** PG 등 상품 구분용 4자리(1000~9999). 없으면 마이그레이션 전 DB */
  payment_code: number | null;
  /** 어드민 점사 대/소메뉴 */
  fortune_menu: FortuneMenuPayload;
  created_at: string;
};

/** DB에 컬럼이 없을 때(마이그레이션 전) PostgREST가 * 또는 확장 select에서 깨지는 경우가 있어, 명시 컬럼 + 폴백 */
const PRODUCT_SELECT_LEGACY =
  "slug,title,quote,category_slug,badge,price_krw,character_key,home_section_slug,tags,thumbnail_svg,created_at";
const PRODUCT_SELECT_WITH_PROFILE = `${PRODUCT_SELECT_LEGACY},saju_input_profile`;
const PRODUCT_SELECT_FULL = `${PRODUCT_SELECT_WITH_PROFILE},payment_code,fortune_menu`;

function missingSajuProfileColumn(msg: string) {
  return msg.includes("saju_input_profile") && msg.includes("does not exist");
}

function missingPaymentOrMenuColumn(msg: string) {
  return (
    (msg.includes("payment_code") || msg.includes("fortune_menu")) &&
    (msg.includes("does not exist") || msg.includes("column"))
  );
}

function asProduct(row: unknown): Product {
  const r = row as Record<string, unknown>;
  const prof = String(r.saju_input_profile ?? "single");
  const saju_input_profile: SajuInputProfile = prof === "pair" ? "pair" : "single";
  return {
    slug: String(r.slug ?? ""),
    title: String(r.title ?? ""),
    quote: String(r.quote ?? ""),
    category_slug: String(r.category_slug ?? ""),
    badge: r.badge == null || r.badge === "" ? null : String(r.badge),
    price_krw: Number(r.price_krw ?? 0),
    character_key: String(r.character_key ?? ""),
    home_section_slug: r.home_section_slug == null || r.home_section_slug === "" ? null : String(r.home_section_slug),
    tags: Array.isArray(r.tags) ? (r.tags as unknown[]).map((t) => String(t)) : [],
    thumbnail_svg: r.thumbnail_svg == null || r.thumbnail_svg === "" ? null : String(r.thumbnail_svg),
    saju_input_profile,
    payment_code:
      r.payment_code == null || r.payment_code === "" ? null : Number(r.payment_code),
    fortune_menu: parseFortuneMenuJson(r.fortune_menu),
    created_at: String(r.created_at ?? ""),
  };
}

export type Review = {
  id: string;
  product_slug: string;
  user_mask: string;
  stars: number;
  body: string;
  tags: string[];
  created_at: string;
};

export async function getCategories(): Promise<Category[]> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("categories")
    .select("slug,label,sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProducts(params: { category?: string } = {}): Promise<Product[]> {
  const supabase = supabaseServer();
  const run = (cols: string) => {
    let q = supabase.from("products").select(cols).order("created_at", { ascending: false });
    if (params.category && params.category !== "all") {
      q = q.eq("category_slug", params.category);
    }
    return q;
  };
  let { data, error } = await run(PRODUCT_SELECT_FULL);
  if (error && missingPaymentOrMenuColumn(error.message)) {
    ({ data, error } = await run(PRODUCT_SELECT_WITH_PROFILE));
  }
  if (error && missingSajuProfileColumn(error.message)) {
    ({ data, error } = await run(PRODUCT_SELECT_LEGACY));
  }
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asProduct(r));
}

export const getProductsCached = cache(getProducts);

export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  if (slugs.length === 0) return [];
  const supabase = supabaseServer();
  const run = (cols: string) =>
    supabase.from("products").select(cols).in("slug", slugs).order("created_at", { ascending: false });
  let { data, error } = await run(PRODUCT_SELECT_FULL);
  if (error && missingPaymentOrMenuColumn(error.message)) {
    ({ data, error } = await run(PRODUCT_SELECT_WITH_PROFILE));
  }
  if (error && missingSajuProfileColumn(error.message)) {
    ({ data, error } = await run(PRODUCT_SELECT_LEGACY));
  }
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asProduct(r));
}

export const getProductsBySlugsCached = cache(getProductsBySlugs);

/** 어드민 `products.character_key` 기준 — 만남 탭 → 캐릭터 상세 「○○의 풀이」 목록 */
export async function getProductsByCharacterKey(characterKey: string): Promise<Product[]> {
  const key = characterKey.trim();
  if (!key) return [];
  const supabase = supabaseServer();
  const run = (cols: string) =>
    supabase.from("products").select(cols).eq("character_key", key).order("created_at", { ascending: false });
  let { data, error } = await run(PRODUCT_SELECT_FULL);
  if (error && missingPaymentOrMenuColumn(error.message)) {
    ({ data, error } = await run(PRODUCT_SELECT_WITH_PROFILE));
  }
  if (error && missingSajuProfileColumn(error.message)) {
    ({ data, error } = await run(PRODUCT_SELECT_LEGACY));
  }
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asProduct(r));
}

export const getProductsByCharacterKeyCached = cache(getProductsByCharacterKey);

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = supabaseServer();
  const run = (cols: string) => supabase.from("products").select(cols).eq("slug", slug).maybeSingle();
  let { data, error } = await run(PRODUCT_SELECT_FULL);
  if (error && missingPaymentOrMenuColumn(error.message)) {
    ({ data, error } = await run(PRODUCT_SELECT_WITH_PROFILE));
  }
  if (error && missingSajuProfileColumn(error.message)) {
    ({ data, error } = await run(PRODUCT_SELECT_LEGACY));
  }

  if (error) throw new Error(error.message);
  return data ? asProduct(data) : null;
}

export const getProductBySlugCached = cache(getProductBySlug);

export async function getReviewsByProductSlug(productSlug: string, opts: { limit?: number } = {}): Promise<Review[]> {
  const supabase = supabaseServer();
  let q = supabase
    .from("reviews")
    .select("id,product_slug,user_mask,stars,body,tags,created_at")
    .eq("product_slug", productSlug)
    .order("created_at", { ascending: false });
  if (typeof opts.limit === "number") q = q.limit(opts.limit);
  const { data, error } = await q;

  if (error) throw new Error(error.message);
  return data ?? [];
}

export const getReviewsByProductSlugCached = cache(getReviewsByProductSlug);

