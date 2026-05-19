"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import {
  archiveReviewKey,
  clearArchiveReviewsCache,
  readArchiveReviewsCache,
  writeArchiveReviewsCache,
} from "@/lib/archive-reviews-cache";
import { registerArchiveReviewsWarm } from "@/lib/archive-reviews-preload-bus";
import { fetchUserArchiveReviewsAll } from "@/lib/reviews-archive-client";
import { USER_REVIEWS_CHANGED_EVENT, type ReviewSourceType, type UserReviewRecord } from "@/lib/reviews-user";

type ArchiveReviewContextValue = {
  getReview: (sourceType: ReviewSourceType, sourceId: string) => UserReviewRecord | null | undefined;
  ready: boolean;
  refresh: () => void;
};

const ArchiveReviewContext = createContext<ArchiveReviewContextValue | null>(null);

function reviewsToMap(reviews: UserReviewRecord[]): Record<string, UserReviewRecord> {
  const map: Record<string, UserReviewRecord> = {};
  for (const review of reviews) {
    map[archiveReviewKey(review.sourceType, review.sourceId)] = review;
  }
  return map;
}

export function ArchiveReviewProvider({ children }: { children: ReactNode }) {
  const { session, user } = useYeonunAuth();
  const userId = user?.id ?? "";
  const accessToken = session?.access_token ?? null;
  const [reviews, setReviews] = useState<Record<string, UserReviewRecord>>({});
  const [ready, setReady] = useState(false);
  const genRef = useRef(0);

  const load = useCallback(() => {
    if (!userId || !accessToken) return;

    const gen = ++genRef.current;
    void (async () => {
      const rows = await fetchUserArchiveReviewsAll(accessToken);
      if (gen !== genRef.current) return;
      const map = reviewsToMap(rows);
      setReviews(map);
      setReady(true);
      writeArchiveReviewsCache(userId, map);
    })();
  }, [accessToken, userId]);

  useLayoutEffect(() => {
    if (!userId || !accessToken) {
      genRef.current += 1;
      setReviews({});
      setReady(false);
      clearArchiveReviewsCache();
      registerArchiveReviewsWarm(null);
      return;
    }

    const cached = readArchiveReviewsCache(userId);
    if (cached) {
      setReviews(cached.reviews);
      setReady(true);
    } else {
      setReviews({});
      setReady(false);
    }

    registerArchiveReviewsWarm(load);
    load();

    return () => {
      registerArchiveReviewsWarm(null);
    };
  }, [accessToken, load, userId]);

  useLayoutEffect(() => {
    const onChange = (ev: Event) => {
      const detail = (ev as CustomEvent<{ review?: UserReviewRecord }>).detail;
      const review = detail?.review;
      if (review && userId) {
        const key = archiveReviewKey(review.sourceType, review.sourceId);
        setReviews((prev) => {
          const next = { ...prev, [key]: review };
          writeArchiveReviewsCache(userId, next);
          return next;
        });
        setReady(true);
        return;
      }
      load();
    };

    window.addEventListener(USER_REVIEWS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(USER_REVIEWS_CHANGED_EVENT, onChange);
  }, [load, userId]);

  const getReview = useCallback(
    (sourceType: ReviewSourceType, sourceId: string) => {
      const key = archiveReviewKey(sourceType, sourceId);
      if (!ready) {
        return reviews[key];
      }
      return reviews[key] ?? null;
    },
    [ready, reviews],
  );

  const ctx = useMemo(() => ({ getReview, ready, refresh: load }), [getReview, load, ready]);

  return <ArchiveReviewContext.Provider value={ctx}>{children}</ArchiveReviewContext.Provider>;
}

export function useArchiveReviewContext() {
  const ctx = useContext(ArchiveReviewContext);
  if (!ctx) {
    throw new Error("useArchiveReviewContext must be used within ArchiveReviewProvider");
  }
  return ctx;
}
