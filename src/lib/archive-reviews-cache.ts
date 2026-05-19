import type { ReviewSourceType, UserReviewRecord } from "@/lib/reviews-user";

const CACHE_PREFIX = "yeonun:archive-reviews.v1";

export type ArchiveReviewsCacheV1 = {
  v: 1;
  userId: string;
  reviews: Record<string, UserReviewRecord>;
  updatedAt: number;
};

let mem: ArchiveReviewsCacheV1 | null = null;

export function archiveReviewKey(sourceType: ReviewSourceType, sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}

function storageKey(userId: string) {
  return `${CACHE_PREFIX}:${userId}`;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota
  }
}

export function readArchiveReviewsCache(userId: string): ArchiveReviewsCacheV1 | null {
  if (mem?.userId === userId) return mem;
  const j = readJson<ArchiveReviewsCacheV1>(storageKey(userId));
  if (j?.v !== 1 || j.userId !== userId || !j.reviews || typeof j.reviews !== "object") return null;
  mem = j;
  return j;
}

export function writeArchiveReviewsCache(userId: string, reviews: Record<string, UserReviewRecord>) {
  const payload: ArchiveReviewsCacheV1 = { v: 1, userId, reviews, updatedAt: Date.now() };
  mem = payload;
  writeJson(storageKey(userId), payload);
}

export function upsertArchiveReviewCache(userId: string, review: UserReviewRecord) {
  const prev = readArchiveReviewsCache(userId);
  const reviews = { ...(prev?.reviews ?? {}), [archiveReviewKey(review.sourceType, review.sourceId)]: review };
  writeArchiveReviewsCache(userId, reviews);
}

export function clearArchiveReviewsCache() {
  mem = null;
  if (typeof window === "undefined") return;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}
