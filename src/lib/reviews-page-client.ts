import { LAUNCH_GUIDE_COUNT, LAUNCH_TOTAL_READINGS, SHOWCASE_REVIEWS_SEED } from "@/lib/reviews-seed-data";
import {
  buildProductLine,
  characterGlyph,
  characterLabel,
  computeDashboardStats,
  formatReviewDate,
  formatTags,
  parseCharacterReviewKey,
  starsToDisplay,
  type CharacterReviewKey,
  type ReviewDashboardStats,
  type ShowcaseReviewView,
} from "@/lib/reviews-types";

export type ReviewsPagePayload = {
  v: 1;
  fetchedAt: number;
  reviews: ShowcaseReviewView[];
  stats: ReviewDashboardStats;
  pageTitle: string;
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

function seedReviews(characterKey: CharacterReviewKey | null): ShowcaseReviewView[] {
  const all = [...SHOWCASE_REVIEWS_SEED].sort((a, b) => b.sort_order - a.sort_order).map(seedToView);
  if (!characterKey) return all;
  return all.filter((r) => r.characterKey === characterKey);
}

/** 네트워크 전 즉시 전체 리뷰 페이지 표시용 */
export function buildReviewsPageSeedSnapshot(characterRaw?: string | null): ReviewsPagePayload {
  const characterKey = parseCharacterReviewKey(characterRaw);
  const reviews = seedReviews(characterKey);
  const stats = computeDashboardStats(reviews, LAUNCH_TOTAL_READINGS);

  return {
    v: 1,
    fetchedAt: 0,
    reviews,
    stats: { ...stats, guideCount: LAUNCH_GUIDE_COUNT },
    pageTitle: characterKey ? `${characterLabel(characterKey)}의 리뷰` : "전체 리뷰",
  };
}
