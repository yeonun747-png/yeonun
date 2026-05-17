import Link from "next/link";

import { ReviewCard } from "@/components/reviews/ReviewCard";
import { getReviewDashboardStatsCached, listShowcaseReviewsCached } from "@/lib/reviews";

export async function HomeReviewsSection() {
  const [reviews, stats] = await Promise.all([
    listShowcaseReviewsCached({ limit: 3 }),
    getReviewDashboardStatsCached(),
  ]);

  return (
    <div className="y-reviews-block">
      <div className="y-section-head">
        <h2 className="y-section-title">
          <span className="hash">#</span> {stats.totalReadings.toLocaleString("ko-KR")}명의 운명
        </h2>
        <Link href="/reviews" className="y-section-more">
          전체 리뷰
        </Link>
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

      <Link className="y-review-more" href="/reviews">
        리뷰 더 보기 ({stats.totalReadings.toLocaleString("ko-KR")}+) →
      </Link>
    </div>
  );
}
