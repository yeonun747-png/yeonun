"use client";

import { buildSajuFingerprint } from "@/lib/fortune-saju-fingerprint";
import { findFortuneDuplicateLocalEntry } from "@/lib/fortune-duplicate-local-index";
import { warmJsonAuthHeaders, jsonAuthHeaders } from "@/lib/fetch-with-auth";
import { readStoredSaju } from "@/lib/fortune-ux/sajuStorage";

export type FortuneDuplicateHit = {
  requestId: string;
  viewedAt: string;
};

const DUP_RESULT_TTL_MS = 90_000;

type DupCacheEntry = { at: number; hit: FortuneDuplicateHit | null };
const resultMemory = new Map<string, DupCacheEntry>();
const inflight = new Map<string, Promise<FortuneDuplicateHit | null>>();

function cacheKey(slug: string, sajuFingerprint: string) {
  return `${slug}|${sajuFingerprint}`;
}

function sajuContextForSlug(productSlug: string): { slug: string; fp: string } | null {
  const saju = readStoredSaju();
  if (!saju) return null;
  const slug = productSlug.trim();
  const fp = buildSajuFingerprint(saju).trim();
  if (!slug || !fp) return null;
  return { slug, fp };
}

/** sessionStorage 로컬 인덱스 — 동기, 클릭 직후 팝업용 */
export function peekFortuneDuplicateLocal(productSlug: string): FortuneDuplicateHit | null {
  const ctx = sajuContextForSlug(productSlug);
  if (!ctx) return null;
  const local = findFortuneDuplicateLocalEntry(ctx.slug, ctx.fp);
  if (!local) return null;
  return { requestId: local.requestId, viewedAt: local.completedAt };
}

/** 카드 hover/touch 시 중복 API·auth 선행 */
export function preloadFortuneDuplicateCheck(productSlug: string): void {
  warmJsonAuthHeaders();
  const key = productSlug.trim();
  if (!key) return;
  const instant = peekFortuneDuplicateLocal(key);
  if (instant) {
    const ctx = sajuContextForSlug(key);
    if (ctx) resultMemory.set(cacheKey(ctx.slug, ctx.fp), { at: Date.now(), hit: instant });
    return;
  }
  void resolveFortuneDuplicateForProduct(key);
}

export async function resolveFortuneDuplicateForProduct(
  productSlug: string,
): Promise<FortuneDuplicateHit | null> {
  const instant = peekFortuneDuplicateLocal(productSlug);
  if (instant) return instant;

  const ctx = sajuContextForSlug(productSlug);
  if (!ctx) return null;

  const key = cacheKey(ctx.slug, ctx.fp);
  const cached = resultMemory.get(key);
  if (cached && Date.now() - cached.at < DUP_RESULT_TTL_MS) {
    return cached.hit;
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const task = (async (): Promise<FortuneDuplicateHit | null> => {
    try {
      const headers = await jsonAuthHeaders();
      const qs = new URLSearchParams({
        product_slug: ctx.slug,
        saju_fingerprint: ctx.fp,
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

      let hit: FortuneDuplicateHit | null = null;
      if (res.ok && data.ok && data.duplicate && data.request_id && data.viewed_at) {
        hit = { requestId: data.request_id, viewedAt: data.viewed_at };
      } else {
        const local = findFortuneDuplicateLocalEntry(ctx.slug, ctx.fp);
        if (local) hit = { requestId: local.requestId, viewedAt: local.completedAt };
      }

      resultMemory.set(key, { at: Date.now(), hit });
      return hit;
    } catch {
      const local = findFortuneDuplicateLocalEntry(ctx.slug, ctx.fp);
      const hit = local ? { requestId: local.requestId, viewedAt: local.completedAt } : null;
      resultMemory.set(key, { at: Date.now(), hit });
      return hit;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return task;
}

/** @deprecated resolveFortuneDuplicateForProduct 사용 */
export const findFortuneDuplicateForProduct = resolveFortuneDuplicateForProduct;

export function fortuneLibraryHref(requestId: string): string {
  return `/library/${encodeURIComponent(requestId)}`;
}
