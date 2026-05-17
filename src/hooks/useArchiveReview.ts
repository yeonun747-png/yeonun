"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchUserArchiveReview } from "@/lib/reviews-archive-client";
import { USER_REVIEWS_CHANGED_EVENT, type ReviewSourceType, type UserReviewRecord } from "@/lib/reviews-user";
import { supabaseBrowser } from "@/lib/supabase/client";

export function useArchiveReview(sourceType: ReviewSourceType, sourceId: string) {
  const [record, setRecord] = useState<UserReviewRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const sb = supabaseBrowser();
      const session = sb ? (await sb.auth.getSession()).data.session : null;
      if (!session?.access_token) {
        setRecord(null);
        return;
      }
      const review = await fetchUserArchiveReview(session.access_token, sourceType, sourceId);
      setRecord(review);
    } catch {
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [sourceType, sourceId]);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(USER_REVIEWS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(USER_REVIEWS_CHANGED_EVENT, onChange);
  }, [refresh]);

  return { record, submitted: Boolean(record), loading, refresh };
}
