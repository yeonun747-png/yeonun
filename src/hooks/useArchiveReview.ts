"use client";

import { useCallback } from "react";

import { useArchiveReviewContext } from "@/components/reviews/ArchiveReviewProvider";
import { archiveReviewKey } from "@/lib/archive-reviews-cache";
import type { ReviewSourceType } from "@/lib/reviews-user";

export function useArchiveReview(sourceType: ReviewSourceType, sourceId: string) {
  const { getReview, ready, refresh } = useArchiveReviewContext();
  const key = archiveReviewKey(sourceType, sourceId);
  const cached = getReview(sourceType, sourceId);

  const record = ready ? (cached ?? null) : cached !== undefined ? cached : null;
  const loading = !ready && cached === undefined;

  const refreshOne = useCallback(() => {
    refresh();
  }, [refresh]);

  return {
    record,
    submitted: Boolean(record),
    loading,
    refresh: refreshOne,
  };
}
