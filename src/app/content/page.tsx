import Link from "next/link";

import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";
import { getCategories, getProducts } from "@/lib/data/content";

const CATEGORY_COUNTS: Record<string, number> = {
  all: 32,
  love: 9,
  saju: 7,
  compat: 4,
  career: 5,
  newyear: 3,
  zimi: 2,
  naming: 3,
  dream: 1,
};

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const sp = await searchParams;
  const category = sp.category ?? "all";

  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ category }),
  ]);

  const total = CATEGORY_COUNTS[category] ?? products.length;

  return (
    <div className="yeonunPage">
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
                const count = CATEGORY_COUNTS[c.slug] ?? 0;
                return (
                  <Link
                    key={c.slug}
                    className={`yCatTab ${active ? "active" : ""}`}
                    href={`/content?category=${encodeURIComponent(c.slug)}`}
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
            <button className="ySortTab active" type="button">
              인기순
            </button>
            <button className="ySortTab" type="button">
              최신순
            </button>
            <button className="ySortTab" type="button">
              가격순
            </button>
          </div>
          <button className="ySortFilter" type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="10" y1="18" x2="14" y2="18" />
            </svg>
            필터
          </button>
        </div>

        <div className="yCatGrid" aria-label="풀이 목록">
          {products.map((p) => (
            <Link key={p.slug} className={`yContentCard ${p.character_key}`} href={`/content/${p.slug}?sheet=1`}>
              <div className="yContentVisual">
                {p.badge ? (
                  <span className={`yContentBadge ${p.badge === "HOT" ? "hot" : p.badge === "NEW" ? "new" : ""}`}>
                    {p.badge}
                  </span>
                ) : null}
                <div className="yContentHan" aria-hidden="true">
                  緣
                </div>
                <span className="yContentTagOn">{p.category_slug}</span>
              </div>
              <div className="yContentMeta">
                <h2 className="yContentTitle">{p.title}</h2>
                <p className="yContentQuote">{p.quote}</p>
                <div className="yContentTagsRow">
                  <div className="yContentTags">#</div>
                  <div className="yContentPrice">
                    {p.price_krw.toLocaleString("ko-KR")}
                    <span className="small">원</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <Link className="yReviewMore" href="/content" style={{ marginBottom: 20 }}>
          전체 {total}개 보기 →
        </Link>

        <div style={{ height: 80 }} />
      </main>
      <BottomNav />
    </div>
  );
}

