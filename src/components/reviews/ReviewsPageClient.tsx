"use client";

import { useMemo, useState } from "react";

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

const FILTERS: { key: ReviewStarBucket; label: (n: number) => string }[] = [
  { key: "all", label: (n) => `전체 (${n})` },
  { key: "5", label: (n) => `★★★★★ (${n})` },
  { key: "4", label: (n) => `★★★★☆ (${n})` },
  { key: "3", label: (n) => `★★★☆☆ 이하 (${n})` },
];

export function ReviewsPageClient({ reviews, stats, pageTitle = "전체 리뷰" }: Props) {
  const [filter, setFilter] = useState<ReviewStarBucket>("all");

  const filtered = useMemo(
    () => reviews.filter((r) => matchesStarFilter(r.stars, filter)),
    [reviews, filter],
  );

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

      <FilterRow filter={filter} stats={stats} onChange={setFilter} />

      <div className="rv-list" aria-label="리뷰 목록">
        {filtered.map((review) => (
          <ReviewCard key={review.id} review={review} variant="page" />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rv-empty">해당 별점의 리뷰가 없습니다.</p>
      ) : (
        <p className="rv-end">리뷰를 모두 확인했어요 ✓</p>
      )}
    </div>
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
