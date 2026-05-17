import type { ReviewSourceType, UserReviewRecord } from "@/lib/reviews-user";

export async function fetchUserArchiveReview(
  accessToken: string,
  sourceType: ReviewSourceType,
  sourceId: string,
): Promise<UserReviewRecord | null> {
  const params = new URLSearchParams({ sourceType, sourceId });
  const res = await fetch(`/api/reviews/archive?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (res.status === 401) return null;
  if (!res.ok) return null;
  const json = (await res.json()) as { review?: UserReviewRecord | null };
  return json.review ?? null;
}

export async function submitUserArchiveReview(
  accessToken: string,
  payload: {
    sourceType: ReviewSourceType;
    sourceId: string;
    productSlug: string;
    stars: number;
    body: string;
    tags: string[];
    characterKey: string;
    productLine: string;
    title: string;
  },
): Promise<{ ok: true; review: UserReviewRecord } | { ok: false; error: string }> {
  const res = await fetch("/api/reviews/archive", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { review?: UserReviewRecord; error?: string };
  if (!res.ok) return { ok: false, error: json.error ?? "save_failed" };
  if (!json.review) return { ok: false, error: "save_failed" };
  return { ok: true, review: json.review };
}
