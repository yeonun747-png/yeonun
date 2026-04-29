import { supabaseServer } from "@/lib/supabase/server";
import { cache } from "react";

export type Category = {
  slug: string;
  label: string;
  sort_order: number;
};

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
  created_at: string;
};

function asProduct(row: Record<string, unknown>): Product {
  return {
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    quote: String(row.quote ?? ""),
    category_slug: String(row.category_slug ?? ""),
    badge: row.badge == null || row.badge === "" ? null : String(row.badge),
    price_krw: Number(row.price_krw ?? 0),
    character_key: String(row.character_key ?? ""),
    home_section_slug: row.home_section_slug == null || row.home_section_slug === "" ? null : String(row.home_section_slug),
    tags: Array.isArray(row.tags) ? (row.tags as unknown[]).map((t) => String(t)) : [],
    thumbnail_svg: row.thumbnail_svg == null || row.thumbnail_svg === "" ? null : String(row.thumbnail_svg),
    created_at: String(row.created_at ?? ""),
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
  let q = supabase
    .from("products")
    .select("slug,title,quote,category_slug,badge,price_krw,character_key,home_section_slug,tags,thumbnail_svg,created_at")
    .order("created_at", { ascending: false });
  if (params.category && params.category !== "all") {
    q = q.eq("category_slug", params.category);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asProduct(r as Record<string, unknown>));
}

export const getProductsCached = cache(getProducts);

export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  if (slugs.length === 0) return [];
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("products")
    .select("slug,title,quote,category_slug,badge,price_krw,character_key,home_section_slug,tags,thumbnail_svg,created_at")
    .in("slug", slugs)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asProduct(r as Record<string, unknown>));
}

export const getProductsBySlugsCached = cache(getProductsBySlugs);

/** 어드민 `products.character_key` 기준 — 만남 탭 → 캐릭터 상세 「○○의 풀이」 목록 */
export async function getProductsByCharacterKey(characterKey: string): Promise<Product[]> {
  const key = characterKey.trim();
  if (!key) return [];
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("products")
    .select("slug,title,quote,category_slug,badge,price_krw,character_key,home_section_slug,tags,thumbnail_svg,created_at")
    .eq("character_key", key)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asProduct(r as Record<string, unknown>));
}

export const getProductsByCharacterKeyCached = cache(getProductsByCharacterKey);

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("products")
    .select("slug,title,quote,category_slug,badge,price_krw,character_key,home_section_slug,tags,thumbnail_svg,created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? asProduct(data as Record<string, unknown>) : null;
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

