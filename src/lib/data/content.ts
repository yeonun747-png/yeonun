import { supabaseServer } from "@/lib/supabase/server";

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
};

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
    .select("slug,title,quote,category_slug,badge,price_krw,character_key")
    .order("created_at", { ascending: false });
  if (params.category && params.category !== "all") {
    q = q.eq("category_slug", params.category);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("products")
    .select("slug,title,quote,category_slug,badge,price_krw,character_key")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getReviewsByProductSlug(productSlug: string): Promise<Review[]> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("reviews")
    .select("id,product_slug,user_mask,stars,body,tags,created_at")
    .eq("product_slug", productSlug)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

