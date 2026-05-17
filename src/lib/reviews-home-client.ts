import {
  LAUNCH_GUIDE_COUNT,
  LAUNCH_TOTAL_READINGS,
  SHOWCASE_REVIEWS_SEED,
} from "@/lib/reviews-seed-data";
import {
  buildProductLine,
  characterGlyph,
  characterLabel,
  formatReviewDate,
  formatTags,
  starsToDisplay,
  type ShowcaseReviewView,
} from "@/lib/reviews-types";

export type HomeReviewsBlockPayload = {
  v: 1;
  fetchedAt: number;
  reviews: ShowcaseReviewView[];
  stats: {
    totalReadings: number;
    averageRatingDisplay: string;
    guideCount: number;
  };
};

function seedToView(seed: (typeof SHOWCASE_REVIEWS_SEED)[number]): ShowcaseReviewView {
  const characterKey = seed.character_key;
  return {
    id: seed.id,
    characterKey,
    characterGlyph: characterGlyph(characterKey),
    characterLabel: characterLabel(characterKey),
    userMask: seed.user_mask,
    productLabel: seed.product_label,
    productLine: buildProductLine(characterKey, seed.product_label),
    stars: seed.stars,
    starsDisplay: starsToDisplay(seed.stars),
    body: seed.body,
    tagsDisplay: formatTags(seed.tags),
    date: formatReviewDate(seed.reviewed_on),
  };
}

/** 홈 리뷰 블록 — 네트워크 전 즉시 표시용 시드 */
export function buildHomeReviewsSeedSnapshot(): HomeReviewsBlockPayload {
  const reviews = [...SHOWCASE_REVIEWS_SEED]
    .sort((a, b) => b.sort_order - a.sort_order)
    .slice(0, 3)
    .map(seedToView);
  const sum = reviews.reduce((acc, r) => acc + r.stars, 0);
  const avg = reviews.length > 0 ? (sum / reviews.length).toFixed(1) : "4.9";

  return {
    v: 1,
    fetchedAt: 0,
    reviews,
    stats: {
      totalReadings: LAUNCH_TOTAL_READINGS,
      averageRatingDisplay: avg,
      guideCount: LAUNCH_GUIDE_COUNT,
    },
  };
}
