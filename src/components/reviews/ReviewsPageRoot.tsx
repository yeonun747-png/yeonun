"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ReviewsPageClient } from "@/components/reviews/ReviewsPageClient";
import { buildReviewsPageSeedSnapshot, type ReviewsPagePayload } from "@/lib/reviews-page-client";
import { preloadReviewsPage, resolveInitialReviewsPage } from "@/lib/reviews-page-cache";

export function ReviewsPageRoot() {
  const searchParams = useSearchParams();
  const characterRaw = searchParams.get("character");
  const cacheKey = useMemo(() => characterRaw?.trim() || null, [characterRaw]);

  const [payload, setPayload] = useState<ReviewsPagePayload>(() => resolveInitialReviewsPage(cacheKey));

  useEffect(() => {
    setPayload(resolveInitialReviewsPage(cacheKey));
    void preloadReviewsPage(cacheKey).then((next) => {
      if (next?.reviews.length) setPayload(next);
    });
  }, [cacheKey]);

  const view =
    payload.reviews.length > 0 ? payload : buildReviewsPageSeedSnapshot(cacheKey);

  return <ReviewsPageClient reviews={view.reviews} stats={view.stats} pageTitle={view.pageTitle} />;
}
