export type CharacterReviewKey = "yeon" | "yeo" | "un" | "byeol";

export type ShowcaseReviewView = {
  id: string;
  characterKey: CharacterReviewKey;
  characterGlyph: string;
  characterLabel: string;
  userMask: string;
  productLabel: string;
  productLine: string;
  stars: number;
  starsDisplay: string;
  body: string;
  tagsDisplay: string;
  date: string;
};

export type ReviewStarBucket = "all" | "5" | "4" | "3";

export type ReviewDashboardStats = {
  totalReadings: number;
  averageRating: number;
  averageRatingDisplay: string;
  summaryStarsDisplay: string;
  guideCount: number;
  reviewCount: number;
  starDistribution: { star: number; count: number; percent: number }[];
  filterCounts: Record<ReviewStarBucket, number>;
};

const CHARACTER_GLYPH: Record<CharacterReviewKey, string> = {
  yeon: "蓮",
  yeo: "麗",
  un: "雲",
  byeol: "星",
};

const CHARACTER_LABEL: Record<CharacterReviewKey, string> = {
  yeon: "연화",
  yeo: "여연",
  un: "운서",
  byeol: "별하",
};

export function characterGlyph(key: CharacterReviewKey): string {
  return CHARACTER_GLYPH[key];
}

export function characterLabel(key: CharacterReviewKey): string {
  return CHARACTER_LABEL[key];
}

export function parseCharacterReviewKey(raw: string | null | undefined): CharacterReviewKey | null {
  if (raw === "yeon" || raw === "yeo" || raw === "un" || raw === "byeol") return raw;
  return null;
}

export function formatReviewDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${y}.${m}.${d}`;
}

export function starsToDisplay(stars: number): string {
  const rounded = Math.max(1, Math.min(5, Math.round(stars)));
  const filled = "★".repeat(rounded);
  const empty = "☆".repeat(5 - rounded);
  return filled + empty;
}

export function formatTags(tags: string[]): string {
  return tags
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .join(" ");
}

export function buildProductLine(characterKey: CharacterReviewKey, productLabel: string): string {
  return `${characterLabel(characterKey)} · ${productLabel}`;
}

function buildDashboardStats(reviewCount: number, sumStars: number, starBuckets: number[], totalReadings: number): ReviewDashboardStats {
  const averageRating = reviewCount > 0 ? Math.round((sumStars / reviewCount) * 10) / 10 : 4.6;
  const averageRatingDisplay = averageRating.toFixed(1);

  const dist = [5, 4, 3, 2, 1].map((star) => {
    const count = starBuckets[star] ?? 0;
    return {
      star,
      count,
      percent: reviewCount > 0 ? Math.round((count / reviewCount) * 100) : 0,
    };
  });

  const filterCounts: Record<ReviewStarBucket, number> = {
    all: reviewCount,
    "5": starBuckets[5] ?? 0,
    "4": starBuckets[4] ?? 0,
    "3": (starBuckets[3] ?? 0) + (starBuckets[2] ?? 0) + (starBuckets[1] ?? 0),
  };

  return {
    totalReadings,
    averageRating,
    averageRatingDisplay,
    summaryStarsDisplay: starsToDisplay(Math.round(averageRating)),
    guideCount: 4,
    reviewCount,
    starDistribution: dist,
    filterCounts,
  };
}

export function computeDashboardStatsFromStars(stars: number[], totalReadings: number): ReviewDashboardStats {
  const buckets: number[] = [];
  let sum = 0;
  for (const raw of stars) {
    const s = Math.max(1, Math.min(5, Math.round(raw)));
    sum += s;
    buckets[s] = (buckets[s] ?? 0) + 1;
  }
  return buildDashboardStats(stars.length, sum, buckets, totalReadings);
}

export function computeDashboardStats(
  reviews: ShowcaseReviewView[],
  totalReadings: number,
): ReviewDashboardStats {
  const buckets: number[] = [];
  let sum = 0;
  for (const r of reviews) {
    sum += r.stars;
    buckets[r.stars] = (buckets[r.stars] ?? 0) + 1;
  }
  return buildDashboardStats(reviews.length, sum, buckets, totalReadings);
}

export function matchesStarFilter(stars: number, filter: ReviewStarBucket): boolean {
  if (filter === "all") return true;
  if (filter === "5") return stars === 5;
  if (filter === "4") return stars === 4;
  return stars <= 3;
}
