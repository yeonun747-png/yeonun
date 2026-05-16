"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { FortuneExitScrollRestore } from "@/components/fortune/FortuneExitScrollRestore";
import { HomeContentGrid } from "@/components/HomeContentGrid";
import { RoutePrefetcher } from "@/components/RoutePrefetcher";
import { TopNav } from "@/components/TopNav";
import {
  buildCategoryCounts,
  contentListHref,
  filterProductsByCategory,
  nextLatestSortToggle,
  nextPriceSortToggle,
  sortContentProducts,
  type ContentCatalogSnapshot,
  type ContentSort,
} from "@/lib/content-catalog";
import {
  hasContentCatalogCache,
  preloadContentCatalog,
  resolveInitialContentCatalog,
  writeContentCatalogCache,
} from "@/lib/content-catalog-cache";
import { preloadFortuneProducts } from "@/lib/fortune-product-cache";
import { CONTENT_PAGE_UI as t } from "@/lib/content-page-ui";

export function ContentPageClient({
  category: initialCategory,
  sort: initialSort,
  serverCatalog,
}: {
  category: string;
  sort: ContentSort;
  serverCatalog: ContentCatalogSnapshot;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState<ContentSort>(initialSort);

  useEffect(() => {
    setCategory(initialCategory);
    setSort(initialSort);
  }, [initialCategory, initialSort]);

  const [catalog, setCatalog] = useState<ContentCatalogSnapshot>(() => resolveInitialContentCatalog(serverCatalog));

  useEffect(() => {
    if (serverCatalog.products.length > 0) writeContentCatalogCache(serverCatalog);
    setCatalog((prev) => {
      if (serverCatalog.products.length === 0 && prev.products.length > 0) return prev;
      return serverCatalog.fetchedAt >= prev.fetchedAt ? serverCatalog : prev;
    });
  }, [serverCatalog]);

  useEffect(() => {
    void preloadContentCatalog({ force: catalog.products.length === 0 }).then((fresh) => {
      if (fresh && fresh.fetchedAt > catalog.fetchedAt) setCatalog(fresh);
    });
  }, [catalog.fetchedAt, catalog.products.length]);

  const navigateList = useCallback((nextCategory: string, nextSort: ContentSort) => {
    setCategory(nextCategory);
    setSort(nextSort);
    const href = contentListHref(nextCategory, nextSort);
    window.history.replaceState(window.history.state, "", href);
  }, []);

  const { categories, products: allProducts, thumbFallback } = catalog;
  const products = useMemo(
    () => sortContentProducts(filterProductsByCategory(allProducts, category), sort),
    [allProducts, category, sort],
  );
  const categoryCounts = useMemo(() => buildCategoryCounts(categories, allProducts), [categories, allProducts]);

  useEffect(() => {
    if (allProducts.length === 0) return;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const run = () => preloadFortuneProducts(allProducts.map((p) => p.slug));
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(run, 500);
    return () => window.clearTimeout(t);
  }, [allProducts]);

  const total = products.length;
  const backHref = contentListHref(category, sort);
  const sheetLinkExtra = `back=${encodeURIComponent(backHref)}`;
  const prefetchRoutes = useMemo(
    () =>
      categories.flatMap((c) => [
        contentListHref(c.slug, "popular"),
        contentListHref(c.slug, "latest-desc"),
        contentListHref(c.slug, "price-asc"),
      ]),
    [categories],
  );

  const showSkeleton = allProducts.length === 0 && !hasContentCatalogCache();

  return (
    <div className="yeonunPage">
      <FortuneExitScrollRestore />
      <RoutePrefetcher routes={prefetchRoutes} />
      <TopNav />
      <main>
        <div className="yCatHeader">
          <div className="yCatHeaderRow">
            <h2 className="yCatTitle">{t.title}</h2>
            <div className="yCatCount">
              {t.countPrefix}
              <strong>{showSkeleton ? t.emDash : total}</strong>
              {t.countSuffix}
            </div>
          </div>

          <div className="yCatTabsScroll" aria-label={t.catAria}>
            <div className="yCatTabsTrack">
              {categories.map((c) => {
                const active = c.slug === category;
                const count = categoryCounts[c.slug] ?? 0;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    className={`yCatTab ${active ? "active" : ""}`}
                    onClick={() => navigateList(c.slug, sort)}
                  >
                    {c.label}
                    <span className="count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="ySortBar" aria-label={t.sortAria}>
          <div className="ySortTabs">
            <button
              type="button"
              className={`ySortTab ${sort === "popular" ? "active" : ""}`}
              onClick={() => navigateList(category, "popular")}
            >
              {t.popular}
            </button>
            <button
              type="button"
              className={`ySortTab ${sort === "latest-desc" || sort === "latest-asc" ? "active" : ""}`}
              onClick={() => navigateList(category, nextLatestSortToggle(sort))}
              title={
                sort === "latest-desc"
                  ? t.tLatestOld
                  : sort === "latest-asc"
                    ? t.tLatestNew
                    : t.tLatestDefault
              }
            >
              {t.latest}
              {sort === "latest-desc" ? ` ${t.arrowDown}` : sort === "latest-asc" ? ` ${t.arrowUp}` : ""}
            </button>
            <button
              type="button"
              className={`ySortTab ${sort === "price-asc" || sort === "price-desc" ? "active" : ""}`}
              onClick={() => navigateList(category, nextPriceSortToggle(sort))}
              title={
                sort === "price-asc"
                  ? t.tPriceHigh
                  : sort === "price-desc"
                    ? t.tPriceLow
                    : t.tPriceDefault
              }
            >
              {t.price}
              {sort === "price-asc" ? ` ${t.arrowUp}` : sort === "price-desc" ? ` ${t.arrowDown}` : ""}
            </button>
          </div>
        </div>

        <div className="y-content-tab-wrap" aria-label={t.listAria}>
          {showSkeleton ? (
            <ContentGridSkeleton />
          ) : products.length ? (
            <HomeContentGrid items={products} fallbackSvgBySlug={thumbFallback} extraSearchParams={sheetLinkExtra} />
          ) : (
            <p className="y-content-empty">{t.empty}</p>
          )}
        </div>

        <div style={{ height: 80 }} />
      </main>
      <BottomNav />
    </div>
  );
}

function ContentGridSkeleton() {
  return (
    <div className="y-content-grid y-content-grid--skeleton" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="y-content-card y-content-card--skeleton">
          <div className="y-content-visual y-content-skeleton-block" />
          <div className="y-content-meta">
            <div className="y-content-skeleton-line y-content-skeleton-line--title" />
            <div className="y-content-skeleton-line y-content-skeleton-line--quote" />
          </div>
        </div>
      ))}
    </div>
  );
}
