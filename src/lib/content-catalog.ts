import type { Category, Product } from "@/lib/data/content";

export type ContentSort = "popular" | "latest-desc" | "latest-asc" | "price-asc" | "price-desc";

export type ContentCatalogSnapshot = {
  v: 1;
  categories: Category[];
  products: Product[];
  thumbFallback: Record<string, string>;
  fetchedAt: number;
};

export function parseContentSort(v: string | undefined): ContentSort {
  if (v === "latest-asc") return "latest-asc";
  if (v === "latest-desc" || v === "latest") return "latest-desc";
  if (v === "price-desc") return "price-desc";
  if (v === "price-asc" || v === "price") return "price-asc";
  return "popular";
}

export function nextLatestSortToggle(current: ContentSort): ContentSort {
  if (current === "latest-desc") return "latest-asc";
  if (current === "latest-asc") return "latest-desc";
  return "latest-desc";
}

export function nextPriceSortToggle(current: ContentSort): ContentSort {
  if (current === "price-asc") return "price-desc";
  if (current === "price-desc") return "price-asc";
  return "price-asc";
}

export function contentListHref(category: string, sort: ContentSort): string {
  const p = new URLSearchParams();
  if (category !== "all") p.set("category", category);
  if (sort !== "popular") p.set("sort", sort);
  const qs = p.toString();
  return qs ? `/content?${qs}` : "/content";
}

export function sortContentProducts(list: Product[], sort: ContentSort): Product[] {
  const out = [...list];
  const ts = (s: string) => (s ? new Date(s).getTime() : 0);
  if (sort === "latest-desc") {
    out.sort((a, b) => ts(b.created_at) - ts(a.created_at));
    return out;
  }
  if (sort === "latest-asc") {
    out.sort((a, b) => ts(a.created_at) - ts(b.created_at));
    return out;
  }
  if (sort === "price-asc") {
    out.sort((a, b) => a.price_krw - b.price_krw);
    return out;
  }
  if (sort === "price-desc") {
    out.sort((a, b) => b.price_krw - a.price_krw);
    return out;
  }
  const badgeRank = (badge: string | null) => {
    if (badge === "HOT") return 0;
    if (badge === "NEW") return 1;
    if (badge === "SIGNATURE") return 2;
    if (badge && /^\d{4}$/.test(badge)) return 3;
    return 4;
  };
  out.sort((a, b) => {
    const br = badgeRank(a.badge) - badgeRank(b.badge);
    if (br !== 0) return br;
    return ts(b.created_at) - ts(a.created_at);
  });
  return out;
}

export function buildCategoryCounts(categories: Category[], allProducts: Product[]): Record<string, number> {
  const categoryCounts: Record<string, number> = {};
  for (const c of categories) {
    categoryCounts[c.slug] =
      c.slug === "all" ? allProducts.length : allProducts.filter((p) => p.category_slug === c.slug).length;
  }
  return categoryCounts;
}

export function filterProductsByCategory(allProducts: Product[], category: string): Product[] {
  return category === "all" ? allProducts : allProducts.filter((p) => p.category_slug === category);
}

export function buildCatalogSnapshot(input: {
  categories: Category[];
  products: Product[];
  thumbFallback?: Record<string, string>;
  fetchedAt?: number;
}): ContentCatalogSnapshot {
  return {
    v: 1,
    categories: input.categories,
    products: input.products,
    thumbFallback: input.thumbFallback ?? {},
    fetchedAt: input.fetchedAt ?? Date.now(),
  };
}
