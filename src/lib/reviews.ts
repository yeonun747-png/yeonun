import "server-only";

import { cache } from "react";

import {
  LAUNCH_GUIDE_COUNT,
  LAUNCH_TOTAL_READINGS,
  SHOWCASE_REVIEWS_SEED,
} from "@/lib/reviews-seed-data";
import type { HomeReviewsBlockPayload } from "@/lib/reviews-home-client";
import {
  buildProductLine,
  characterGlyph,
  characterLabel,
  computeDashboardStats,
  computeDashboardStatsFromStars,
  formatReviewDate,
  formatTags,
  starsToDisplay,
  type CharacterReviewKey,
  type ReviewDashboardStats,
  type ShowcaseReviewView,
} from "@/lib/reviews-types";
import { supabaseServer } from "@/lib/supabase/server";

export type { ShowcaseReviewView, ReviewDashboardStats, ReviewStarBucket } from "@/lib/reviews-types";
export {
  characterGlyph,
  characterLabel,
  formatReviewDate,
  formatTags,
  starsToDisplay,
  computeDashboardStats,
  matchesStarFilter,
} from "@/lib/reviews-types";

const SHOWCASE_SELECT =
  "id,product_slug,user_mask,stars,body,tags,character_key,product_label,reviewed_on,sort_order,created_at";

type ShowcaseRow = {
  id: string;
  product_slug: string;
  user_mask: string;
  stars: number;
  body: string;
  tags: string[] | null;
  character_key: string | null;
  product_label: string | null;
  reviewed_on: string | null;
  sort_order: number | null;
  created_at: string;
};

function normalizeCharacterKey(raw: string | null): CharacterReviewKey {
  if (raw === "yeo" || raw === "un" || raw === "byeol") return raw;
  return "yeon";
}

function rowToView(row: ShowcaseRow): ShowcaseReviewView {
  const characterKey = normalizeCharacterKey(row.character_key);
  const productLabel = row.product_label?.trim() || row.product_slug;
  const reviewedOn = row.reviewed_on ?? row.created_at.slice(0, 10);
  const stars = Number(row.stars) || 5;

  return {
    id: row.id,
    characterKey,
    characterGlyph: characterGlyph(characterKey),
    characterLabel: characterLabel(characterKey),
    userMask: row.user_mask,
    productLabel,
    productLine: buildProductLine(characterKey, productLabel),
    stars,
    starsDisplay: starsToDisplay(stars),
    body: row.body,
    tagsDisplay: formatTags(row.tags ?? []),
    date: formatReviewDate(reviewedOn),
  };
}

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

function seedFallback(): ShowcaseReviewView[] {
  return [...SHOWCASE_REVIEWS_SEED]
    .sort((a, b) => b.sort_order - a.sort_order)
    .map(seedToView);
}

function parseRows(data: unknown): ShowcaseRow[] {
  if (!Array.isArray(data)) return [];
  return data as ShowcaseRow[];
}

function shouldUseSeedFallback(error: { message: string } | null): boolean {
  if (!error) return false;
  const m = error.message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("is_published") ||
    m.includes("character_key") ||
    m.includes("product_label")
  );
}

/** 어드민 노출(is_published)된 모든 리뷰 — 유저·운영 공통 */
export async function listPublishedReviews(opts: { limit?: number } = {}): Promise<ShowcaseReviewView[]> {
  try {
    const supabase = supabaseServer();
    let q = supabase
      .from("reviews")
      .select(SHOWCASE_SELECT)
      .eq("is_published", true)
      .order("reviewed_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (typeof opts.limit === "number") {
      q = q.limit(opts.limit);
    }

    const { data, error } = await q;
    if (error) {
      if (shouldUseSeedFallback(error)) {
        const all = seedFallback();
        return typeof opts.limit === "number" ? all.slice(0, opts.limit) : all;
      }
      return [];
    }

    return parseRows(data).map(rowToView);
  } catch {
    return seedFallback().slice(0, opts.limit ?? undefined);
  }
}

/** @deprecated 이름 유지 — 내부는 listPublishedReviews와 동일 */
export async function listShowcaseReviews(opts: { limit?: number } = {}): Promise<ShowcaseReviewView[]> {
  return listPublishedReviews(opts);
}

export const listPublishedReviewsCached = cache(listPublishedReviews);
export const listShowcaseReviewsCached = listPublishedReviewsCached;

export async function listPublishedReviewsByCharacterKey(
  characterKey: CharacterReviewKey,
  opts: { limit?: number } = {},
): Promise<ShowcaseReviewView[]> {
  const key = normalizeCharacterKey(characterKey);

  try {
    const supabase = supabaseServer();
    let q = supabase
      .from("reviews")
      .select(SHOWCASE_SELECT)
      .eq("is_published", true)
      .eq("character_key", key)
      .order("reviewed_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (typeof opts.limit === "number") {
      q = q.limit(opts.limit);
    }

    const { data, error } = await q;
    if (error) {
      if (shouldUseSeedFallback(error)) {
        const fallback = seedFallback().filter((r) => r.characterKey === key);
        return typeof opts.limit === "number" ? fallback.slice(0, opts.limit) : fallback;
      }
      return [];
    }

    return parseRows(data).map(rowToView);
  } catch {
    const fallback = seedFallback().filter((r) => r.characterKey === key);
    return typeof opts.limit === "number" ? fallback.slice(0, opts.limit) : fallback;
  }
}

export const listPublishedReviewsByCharacterKeyCached = cache(listPublishedReviewsByCharacterKey);

async function fetchPaidOrdersCount(): Promise<number> {
  try {
    const supabase = supabaseServer();
    const { count, error } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "paid");

    if (!error && typeof count === "number" && count > 0) {
      return Math.max(count, LAUNCH_TOTAL_READINGS);
    }
  } catch {
    /* 런칭 수치 유지 */
  }
  return LAUNCH_TOTAL_READINGS;
}

async function fetchPublishedReviewStars(): Promise<number[]> {
  try {
    const supabase = supabaseServer();
    const { data, error } = await supabase.from("reviews").select("stars").eq("is_published", true);
    if (error) {
      if (shouldUseSeedFallback(error)) return seedFallback().map((r) => r.stars);
      return seedFallback().map((r) => r.stars);
    }
    if (!data?.length) return seedFallback().map((r) => r.stars);
    return data.map((r) => Number((r as { stars?: number }).stars) || 5);
  } catch {
    return seedFallback().map((r) => r.stars);
  }
}

export async function getReviewDashboardStats(): Promise<ReviewDashboardStats> {
  const [stars, totalReadings] = await Promise.all([fetchPublishedReviewStars(), fetchPaidOrdersCount()]);
  const stats = computeDashboardStatsFromStars(stars, totalReadings);
  return { ...stats, guideCount: LAUNCH_GUIDE_COUNT };
}

export const getReviewDashboardStatsCached = cache(getReviewDashboardStats);

/** 홈 탭 리뷰 블록 — 최대 3건 + 요약 통계만 */
export async function getHomeReviewsBlockData(): Promise<HomeReviewsBlockPayload> {
  const [reviews, stars, totalReadings] = await Promise.all([
    listPublishedReviews({ limit: 3 }),
    fetchPublishedReviewStars(),
    fetchPaidOrdersCount(),
  ]);
  const stats = computeDashboardStatsFromStars(stars, totalReadings);
  return {
    v: 1,
    fetchedAt: Date.now(),
    reviews,
    stats: {
      totalReadings: stats.totalReadings,
      publishedReviewCount: stats.reviewCount,
      averageRatingDisplay: stats.averageRatingDisplay,
      guideCount: LAUNCH_GUIDE_COUNT,
    },
  };
}

export const getHomeReviewsBlockDataCached = cache(getHomeReviewsBlockData);

/** 전체 리뷰 페이지 — 리뷰 목록 1회 조회로 통계까지 계산 */
export async function getReviewsPageData() {
  const [reviews, totalReadings] = await Promise.all([listPublishedReviewsCached(), fetchPaidOrdersCount()]);
  const stats = computeDashboardStats(reviews, totalReadings);
  return {
    reviews,
    stats: { ...stats, guideCount: LAUNCH_GUIDE_COUNT },
    pageTitle: "전체 리뷰" as const,
  };
}

export const getReviewsPageDataCached = cache(getReviewsPageData);

export async function getReviewsPageDataForCharacter(characterKey: CharacterReviewKey) {
  const reviews = await listPublishedReviewsByCharacterKeyCached(characterKey);
  const stats = computeDashboardStats(reviews, LAUNCH_TOTAL_READINGS);
  return {
    reviews,
    stats: { ...stats, guideCount: LAUNCH_GUIDE_COUNT },
    pageTitle: `${characterLabel(characterKey)}의 리뷰` as const,
  };
}

export const getReviewsPageDataForCharacterCached = cache(getReviewsPageDataForCharacter);
