"use client";

import { buildReviewsPageSeedSnapshot, type ReviewsPagePayload } from "@/lib/reviews-page-client";

const STORAGE_PREFIX = "yeonun:reviews-page:v1";
const MAX_AGE_MS = 1000 * 60 * 5;

let memory = new Map<string, ReviewsPagePayload>();
let inflight = new Map<string, Promise<ReviewsPagePayload | null>>();

function cacheKey(characterRaw?: string | null) {
  const character = characterRaw?.trim() || "";
  return character ? `${STORAGE_PREFIX}:${character}` : STORAGE_PREFIX;
}

export function readReviewsPageCache(characterRaw?: string | null): ReviewsPagePayload | null {
  const key = cacheKey(characterRaw);
  const mem = memory.get(key);
  if (mem && Date.now() - mem.fetchedAt < MAX_AGE_MS) return mem;

  if (typeof window === "undefined") return mem ?? null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return mem ?? null;
    const parsed = JSON.parse(raw) as ReviewsPagePayload;
    if (parsed?.v !== 1 || !Array.isArray(parsed.reviews) || !parsed.stats) return mem ?? null;
    if (Date.now() - (parsed.fetchedAt ?? 0) > MAX_AGE_MS) return mem ?? null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return mem ?? null;
  }
}

export function writeReviewsPageCache(payload: ReviewsPagePayload, characterRaw?: string | null) {
  const key = cacheKey(characterRaw);
  memory.set(key, payload);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function resolveInitialReviewsPage(
  characterRaw?: string | null,
  server?: ReviewsPagePayload | null,
): ReviewsPagePayload {
  const cached = readReviewsPageCache(characterRaw);
  if (cached?.reviews.length) {
    if (!server?.reviews.length) return cached;
    return server.fetchedAt >= cached.fetchedAt ? server : cached;
  }
  if (server?.reviews.length) return server;
  return buildReviewsPageSeedSnapshot(characterRaw);
}

export async function preloadReviewsPage(characterRaw?: string | null): Promise<ReviewsPagePayload | null> {
  const key = cacheKey(characterRaw);
  const cached = readReviewsPageCache(characterRaw);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const qs = characterRaw?.trim() ? `?character=${encodeURIComponent(characterRaw.trim())}` : "";
  const promise = fetch(`/api/reviews/page${qs}`, { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) return null;
      const j = (await res.json()) as ReviewsPagePayload & { ok?: boolean };
      if (!j?.reviews?.length || !j.stats) return null;
      const payload: ReviewsPagePayload = {
        v: 1,
        fetchedAt: j.fetchedAt ?? Date.now(),
        reviews: j.reviews,
        stats: j.stats,
        pageTitle: j.pageTitle ?? buildReviewsPageSeedSnapshot(characterRaw).pageTitle,
      };
      writeReviewsPageCache(payload, characterRaw);
      return payload;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}
