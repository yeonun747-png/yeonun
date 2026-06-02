"use client";

import { useEffect, useState } from "react";

import { ReviewCard } from "@/components/reviews/ReviewCard";
import { SheetLink } from "@/components/SheetLink";
import {
  buildHomeReviewsSeedSnapshot,
  type HomeReviewsBlockPayload,
} from "@/lib/reviews-home-client";
import { preloadHomeReviewsBlock, readHomeReviewsCache } from "@/lib/home-reviews-cache";
import { preloadReviewsPage } from "@/lib/reviews-page-cache";

type Props = {
  /** SSR 첫 페인트용(있으면 시드 대신 사용) */
  serverSnapshot?: HomeReviewsBlockPayload | null;
};

export function HomeReviewsSectionClient({ serverSnapshot }: Props) {
  // SSR·클라이언트 첫 페인트는 동일 시드(또는 serverSnapshot)만 사용 — localStorage 캐시는 useEffect에서만 반영
  const initial =
    (serverSnapshot?.reviews.length ? serverSnapshot : null) ?? buildHomeReviewsSeedSnapshot();

  const [block, setBlock] = useState<HomeReviewsBlockPayload>(initial);

  useEffect(() => {
    const cachedNow = readHomeReviewsCache();
    if (cachedNow && cachedNow.fetchedAt > block.fetchedAt) {
      setBlock(cachedNow);
      return;
    }
    void preloadHomeReviewsBlock().then((next) => {
      if (next?.reviews.length) setBlock(next);
    });
    void preloadReviewsPage();
  }, [block.fetchedAt]);

  const { reviews, stats } = block;
  const publishedReviewCount =
    stats.publishedReviewCount ?? buildHomeReviewsSeedSnapshot().stats.publishedReviewCount;

  return (
    <div className="y-reviews-block">
      <div className="y-section-head">
        <h2 className="y-section-title">
          <span className="hash">#</span> {stats.totalReadings.toLocaleString("ko-KR")}명의 운명
        </h2>
        <SheetLink href="/reviews" className="y-section-more">
          전체 리뷰
        </SheetLink>
      </div>

      <div className="y-reviews-stats">
        <div className="y-stat-card">
          <div className="y-stat-num">{stats.totalReadings.toLocaleString("ko-KR")}</div>
          <div className="y-stat-label">누적 풀이</div>
        </div>
        <div className="y-stat-card">
          <div className="y-stat-num">{stats.averageRatingDisplay}</div>
          <div className="y-stat-label">평균 별점</div>
        </div>
        <div className="y-stat-card">
          <div className="y-stat-num">{stats.guideCount}명</div>
          <div className="y-stat-label">인연 안내자</div>
        </div>
      </div>

      <div className="y-review-stack" aria-label="리뷰">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} variant="home" />
        ))}
      </div>

      <SheetLink className="y-review-more" href="/reviews">
        리뷰 더 보기 ({publishedReviewCount.toLocaleString("ko-KR")}+) →
      </SheetLink>
    </div>
  );
}
