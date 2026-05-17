"use client";

import {
  buildHomeReviewsSeedSnapshot,
  type HomeReviewsBlockPayload,
} from "@/lib/reviews-home-client";

const STORAGE_KEY = "yeonun:home-reviews-block:v1";
const MAX_AGE_MS = 1000 * 60 * 5;

let memory: HomeReviewsBlockPayload | null = null;
let inflight: Promise<HomeReviewsBlockPayload | null> | null = null;

export function readHomeReviewsCache(): HomeReviewsBlockPayload | null {
  if (memory && Date.now() - memory.fetchedAt < MAX_AGE_MS) return memory;
  if (typeof window === "undefined") return memory;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return memory;
    const parsed = JSON.parse(raw) as HomeReviewsBlockPayload;
    if (parsed?.v !== 1 || !Array.isArray(parsed.reviews)) return memory;
    if (Date.now() - (parsed.fetchedAt ?? 0) > MAX_AGE_MS) return memory;
    memory = parsed;
    return parsed;
  } catch {
    return memory;
  }
}

export function writeHomeReviewsCache(payload: HomeReviewsBlockPayload): void {
  memory = payload;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function resolveInitialHomeReviews(server?: HomeReviewsBlockPayload | null): HomeReviewsBlockPayload {
  const cached = readHomeReviewsCache();
  if (cached?.reviews.length) {
    if (!server?.reviews.length) return cached;
    return server.fetchedAt >= cached.fetchedAt ? server : cached;
  }
  if (server?.reviews.length) return server;
  return buildHomeReviewsSeedSnapshot();
}

export async function preloadHomeReviewsBlock(): Promise<HomeReviewsBlockPayload | null> {
  const cached = readHomeReviewsCache();
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = fetch("/api/home/reviews-block", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) return null;
      const j = (await res.json()) as HomeReviewsBlockPayload & { ok?: boolean };
      if (!j?.reviews?.length) return null;
      const payload: HomeReviewsBlockPayload = {
        v: 1,
        fetchedAt: j.fetchedAt ?? Date.now(),
        reviews: j.reviews,
        stats: j.stats,
      };
      writeHomeReviewsCache(payload);
      return payload;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
