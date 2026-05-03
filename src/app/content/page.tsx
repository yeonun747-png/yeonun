import Link from "next/link";

import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";
import { HomeContentGrid } from "@/components/HomeMoreSections";
import { RoutePrefetcher } from "@/components/RoutePrefetcher";
import type { Product } from "@/lib/data/content";
import { getCategories, getProducts } from "@/lib/data/content";
import { readProductThumbnailsForSlugs } from "@/lib/data/product-thumbnails";

type ContentSort = "popular" | "latest-desc" | "latest-asc" | "price-asc" | "price-desc";

function parseContentSort(v: string | undefined): ContentSort {
  if (v === "latest-asc") return "latest-asc";
  if (v === "latest-desc" || v === "latest") return "latest-desc";
  if (v === "price-desc") return "price-desc";
  if (v === "price-asc" || v === "price") return "price-asc";
  return "popular";
}

/** 최신순 탭 클릭 시: 최신 먼저 ↔ 오래된 순 전환 (다른 정렬 중이면 최신 먼저) */
function nextLatestSortToggle(current: ContentSort): ContentSort {
  if (current === "latest-desc") return "latest-asc";
  if (current === "latest-asc") return "latest-desc";
  return "latest-desc";
}

/** 가격순 탭 클릭 시: 오름차순 ↔ 내림차순 전환 (다른 정렬 중이면 오름차순부터) */
function nextPriceSortToggle(current: ContentSort): ContentSort {
  if (current === "price-asc") return "price-desc";
  if (current === "price-desc") return "price-asc";
  return "price-asc";
}

function contentListHref(category: string, sort: ContentSort): string {
  const p = new URLSearchParams();
  if (category !== "all") p.set("category", category);
  if (sort !== "popular") p.set("sort", sort);
  const qs = p.toString();
  return qs ? `/content?${qs}` : "/content";
}

function sortContentProducts(list: Product[], sort: ContentSort): Product[] {
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

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const category = sp.category ?? "all";
  const sort = parseContentSort(sp.sort);

  const [categories, allProducts] = await Promise.all([getCategories(), getProducts({})]);

  const filtered = category === "all" ? allProducts : allProducts.filter((p) => p.category_slug === category);
  const products = sortContentProducts(filtered, sort);
  const thumbFallback = await readProductThumbnailsForSlugs(products.filter((p) => !p.thumbnail_svg).map((p) => p.slug));

  const categoryCounts: Record<string, number> = {};
  for (const c of categories) {
    categoryCounts[c.slug] =
      c.slug === "all"
        ? allProducts.length
        : allProducts.filter((p) => p.category_slug === c.slug).length;
  }

  const total = products.length;
  const prefetchRoutes = categories.flatMap((c) => [
    contentListHref(c.slug, "popular"),
    contentListHref(c.slug, "latest-desc"),
    contentListHref(c.slug, "price-asc"),
  ]);

  return (
    <div className="yeonunPage">
      <RoutePrefetcher routes={prefetchRoutes} />
      <TopNav />
      <main>
        <div className="yCatHeader">
          <div className="yCatHeaderRow">
            <h1 className="yCatTitle">전체 풀이</h1>
            <div className="yCatCount">
              총 <strong>{total}</strong>개의 풀이
            </div>
          </div>

          <div className="yCatTabsScroll" aria-label="카테고리">
            <div className="yCatTabsTrack">
              {categories.map((c) => {
                const active = c.slug === category;
                const count = categoryCounts[c.slug] ?? 0;
                return (
                  <Link
                    key={c.slug}
                    className={`yCatTab ${active ? "active" : ""}`}
                    href={contentListHref(c.slug, sort)}
                    scroll={false}
                  >
                    {c.label}
                    <span className="count">{count}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="ySortBar" aria-label="정렬">
          <div className="ySortTabs">
            <Link
              className={`ySortTab ${sort === "popular" ? "active" : ""}`}
              href={contentListHref(category, "popular")}
              scroll={false}
            >
              인기순
            </Link>
            <Link
              className={`ySortTab ${sort === "latest-desc" || sort === "latest-asc" ? "active" : ""}`}
              href={contentListHref(category, nextLatestSortToggle(sort))}
              scroll={false}
              title={
                sort === "latest-desc"
                  ? "등록 오래된 순으로 보기"
                  : sort === "latest-asc"
                    ? "최신 등록 순으로 보기"
                    : "최신 등록 순부터"
              }
            >
              최신순
              {sort === "latest-desc" ? " ↓" : sort === "latest-asc" ? " ↑" : ""}
            </Link>
            <Link
              className={`ySortTab ${sort === "price-asc" || sort === "price-desc" ? "active" : ""}`}
              href={contentListHref(category, nextPriceSortToggle(sort))}
              scroll={false}
              title={
                sort === "price-asc"
                  ? "가격 높은 순으로 보기"
                  : sort === "price-desc"
                    ? "가격 낮은 순으로 보기"
                    : "가격 낮은 순부터"
              }
            >
              가격순
              {sort === "price-asc" ? " ↑" : sort === "price-desc" ? " ↓" : ""}
            </Link>
          </div>
        </div>

        <div className="y-content-tab-wrap" aria-label="풀이 목록">
          {products.length ? (
            <HomeContentGrid items={products} fallbackSvgBySlug={thumbFallback} />
          ) : (
            <p className="y-content-empty">이 카테고리에 등록된 풀이가 없습니다.</p>
          )}
        </div>

        <Link className="yReviewMore" href={contentListHref("all", sort)} style={{ marginBottom: 20 }}>
          전체 {total}개 보기 →
        </Link>

        <div style={{ height: 80 }} />
      </main>
      <BottomNav />
    </div>
  );
}

