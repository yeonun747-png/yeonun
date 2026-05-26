"use client";

import { buildSajuFingerprint } from "@/lib/fortune-saju-fingerprint";
import { findFortuneDuplicateLocalEntry } from "@/lib/fortune-duplicate-local-index";
import { readStoredSaju } from "@/lib/fortune-ux/sajuStorage";
import { jsonAuthHeaders } from "@/lib/fetch-with-auth";

export type FortuneDuplicateHit = {
  requestId: string;
  viewedAt: string;
};

export async function findFortuneDuplicateForProduct(productSlug: string): Promise<FortuneDuplicateHit | null> {
  const saju = readStoredSaju();
  if (!saju) return null;

  const sajuFingerprint = buildSajuFingerprint(saju);
  const slug = productSlug.trim();
  if (!slug || !sajuFingerprint) return null;

  try {
    const headers = await jsonAuthHeaders();
    const qs = new URLSearchParams({
      product_slug: slug,
      saju_fingerprint: sajuFingerprint,
    });
    const res = await fetch(`/api/fortune/duplicate-check?${qs.toString()}`, {
      headers,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      duplicate?: boolean;
      request_id?: string;
      viewed_at?: string;
    };
    if (res.ok && data.ok && data.duplicate && data.request_id && data.viewed_at) {
      return { requestId: data.request_id, viewedAt: data.viewed_at };
    }
  } catch {
    // fall through to local index
  }

  const local = findFortuneDuplicateLocalEntry(slug, sajuFingerprint);
  if (!local) return null;
  return { requestId: local.requestId, viewedAt: local.completedAt };
}

export function fortuneLibraryHref(requestId: string): string {
  return `/library/${encodeURIComponent(requestId)}`;
}
