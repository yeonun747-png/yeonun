"use client";

import { useMemo, useRef, useState } from "react";

import { ReviewCard } from "@/components/reviews/ReviewCard";
import { ReviewsSubNav } from "@/components/reviews/ReviewsSubNav";
import {
  matchesStarFilter,
  type ReviewDashboardStats,
  type ReviewStarBucket,
  type ShowcaseReviewView,
} from "@/lib/reviews-types";

type Props = {
  reviews: ShowcaseReviewView[];
  stats: ReviewDashboardStats;
  pageTitle?: string;
};

const PAGE_SIZE = 10;

const FILTERS: { key: ReviewStarBucket; label: (n: number) => string }[] = [
  { key: "all", label: (n) => `전체 (${n})` },
  { key: "5", label: (n) => `★★★★★ (${n})` },
  { key: "4", label: (n) => `★★★★☆ (${n})` },
  { key: "3", label: (n) => `★★★☆☆ 이하 (${n})` },
];

export function ReviewsPageClient({ reviews, stats, pageTitle = "전체 리뷰" }: Props) {
  const [filter, setFilter] = useState<ReviewStarBucket>("all");
  const [page, setPage] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => reviews.filter((r) => matchesStarFilter(r.stars, filter)),
    [reviews, filter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const paged = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const goPage = (next: number) => {
    const clamped = Math.max(1, Math.min(totalPages, next));
    setPage(clamped);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onFilterChange = (next: ReviewStarBucket) => {
    setFilter(next);
    setPage(1);
  };

  return (
    <div className="yeonunPage rv-page">
      <ReviewsSubNav title={pageTitle} />

      <section className="rv-summary" aria-label="리뷰 요약">
        <div className="rv-big-star">
          {stats.averageRatingDisplay}
          <sup>★</sup>
        </div>
        <div className="rv-summary-right">
          <div className="rv-stars-display" aria-hidden="true">
            {stats.summaryStarsDisplay}
          </div>
          <p className="rv-count">
            {stats.totalReadings.toLocaleString("ko-KR")}명의 풀이 · 리뷰 {stats.reviewCount}개
          </p>
          <div className="rv-bars" aria-label="별점 분포">
            {stats.starDistribution.map((row) => (
              <div key={row.star} className="rv-bar-row">
                <span className="rv-bar-label">{row.star}</span>
                <div className="rv-bar-track">
                  <div className="rv-bar-fill" style={{ width: `${row.percent}%` }} />
                </div>
                <span className="rv-bar-num">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="rv-divider" role="presentation" />

      <FilterRow filter={filter} stats={stats} onChange={onFilterChange} />

      <div ref={listRef} className="rv-list" aria-label="리뷰 목록">
        {paged.map((review) => (
          <ReviewCard key={review.id} review={review} variant="page" />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rv-empty">해당 별점의 리뷰가 없습니다.</p>
      ) : totalPages > 1 ? (
        <ReviewsPagination page={currentPage} totalPages={totalPages} onChange={goPage} />
      ) : (
        <p className="rv-end">리뷰를 모두 확인했어요 ✓</p>
      )}
    </div>
  );
}

function ReviewsPagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const pageNums = useMemo(() => {
    const maxButtons = 5;
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    const end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  return (
    <nav className="rv-pagination" aria-label="리뷰 페이지">
      <div className="rv-pagination-controls">
        <button
          type="button"
          className="rv-page-btn rv-page-btn--arrow"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="이전 페이지"
        >
          ‹
        </button>
        {pageNums.map((n) => (
          <button
            key={n}
            type="button"
            className={`rv-page-btn${n === page ? " active" : ""}`}
            aria-current={n === page ? "page" : undefined}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className="rv-page-btn rv-page-btn--arrow"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="다음 페이지"
        >
          ›
        </button>
      </div>
    </nav>
  );
}

function FilterRow({
  filter,
  stats,
  onChange,
}: {
  filter: ReviewStarBucket;
  stats: ReviewDashboardStats;
  onChange: (f: ReviewStarBucket) => void;
}) {
  return (
    <div className="rv-filter" role="tablist" aria-label="별점 필터">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={filter === key}
          className={`rv-filter-btn${filter === key ? " active" : ""}`}
          onClick={() => onChange(key)}
        >
          {label(stats.filterCounts[key])}
        </button>
      ))}
    </div>
  );
}
