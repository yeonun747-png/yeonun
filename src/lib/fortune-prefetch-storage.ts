import type { FortuneTocItem } from "@/lib/fortune-stream-client";
import type { FortuneTocMainGroup } from "@/lib/product-fortune-menu";

export type FortunePrefetchV1 = {
  v: 1;
  /** 섹션별 HTML 스트림 모드 */
  sectionsMode: boolean;
  complete: boolean;
  toc: FortuneTocItem[];
  toc_groups: FortuneTocMainGroup[] | null;
  sectionHtml: Record<number, string>;
  /** 완료된 섹션 인덱스 */
  doneIdx: number[];
  /** 단일 HTML Claude 스트림 */
  claudeStreamMode: boolean;
  claudeStreamHtml: string;
  updatedAt: number;
};

export const fortunePrefetchStorageKey = (productSlug: string) =>
  `yeonun_fortune_prefetch_${productSlug.trim()}`;

export const fortuneServerPrefetchRequestKey = (productSlug: string) =>
  `yeonun_fortune_server_request_${productSlug.trim()}`;

export function readServerPrefetchRequestId(productSlug: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(fortuneServerPrefetchRequestKey(productSlug));
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export function writeServerPrefetchRequestId(productSlug: string, requestId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(fortuneServerPrefetchRequestKey(productSlug), requestId.trim());
  } catch {
    // ignore
  }
}

export function clearServerPrefetchRequestId(productSlug: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(fortuneServerPrefetchRequestKey(productSlug));
  } catch {
    // ignore
  }
}

export function readFortunePrefetch(productSlug: string): FortunePrefetchV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(fortunePrefetchStorageKey(productSlug));
    if (!raw) return null;
    const j = JSON.parse(raw) as FortunePrefetchV1;
    if (j?.v !== 1) return null;
    return j;
  } catch {
    return null;
  }
}

export function writeFortunePrefetch(productSlug: string, payload: FortunePrefetchV1) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(fortunePrefetchStorageKey(productSlug), JSON.stringify(payload));
  } catch {
    // ignore quota
  }
}
