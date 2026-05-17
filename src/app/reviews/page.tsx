import { ReviewsPageClient } from "@/components/reviews/ReviewsPageClient";
import {
  getReviewDashboardStatsCached,
  listPublishedReviewsByCharacterKeyCached,
  listPublishedReviewsCached,
} from "@/lib/reviews";
import { characterLabel, computeDashboardStats, parseCharacterReviewKey } from "@/lib/reviews-types";
import { LAUNCH_TOTAL_READINGS } from "@/lib/reviews-seed-data";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ character?: string }>;
};

export async function generateMetadata({ searchParams }: Props) {
  const sp = (searchParams ? await searchParams : {}) ?? {};
  const characterKey = parseCharacterReviewKey(sp.character);
  if (characterKey) {
    const name = characterLabel(characterKey);
    return {
      title: `${name}의 리뷰 | 연운 緣運`,
      description: `${name} 인연 안내자에 대한 이용 리뷰를 확인하세요.`,
    };
  }
  return {
    title: "전체 리뷰 | 연운 緣運",
    description: "연운 사용자 리뷰 — 247명의 풀이, 평균 별점과 실제 이용 리뷰를 확인하세요.",
  };
}

export default async function ReviewsPage({ searchParams }: Props) {
  const sp = (searchParams ? await searchParams : {}) ?? {};
  const characterKey = parseCharacterReviewKey(sp.character);

  if (characterKey) {
    const reviews = await listPublishedReviewsByCharacterKeyCached(characterKey);
    const stats = computeDashboardStats(reviews, LAUNCH_TOTAL_READINGS);
    return (
      <ReviewsPageClient
        reviews={reviews}
        stats={{ ...stats, guideCount: 4 }}
        pageTitle={`${characterLabel(characterKey)}의 리뷰`}
      />
    );
  }

  const [reviews, stats] = await Promise.all([
    listPublishedReviewsCached(),
    getReviewDashboardStatsCached(),
  ]);

  return <ReviewsPageClient reviews={reviews} stats={stats} />;
}
