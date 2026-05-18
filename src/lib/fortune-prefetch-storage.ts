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

function prefetchSectionCount(prefetch: FortunePrefetchV1): number {
  const tocN = prefetch.toc.length;
  const htmlKeys = Object.keys(prefetch.sectionHtml)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const htmlN = htmlKeys.length ? Math.max(...htmlKeys) + 1 : 0;
  return Math.max(tocN, htmlN);
}

/** SSE `done` 없이 본문만 채워진 경우(서버 Tank·업스트림 조기 종료) 완료로 간주 */
export function inferFortunePrefetchComplete(prefetch: FortunePrefetchV1): boolean {
  if (prefetch.complete) return true;
  if (prefetch.claudeStreamMode) {
    return prefetch.claudeStreamHtml.trim().length >= 80;
  }
  const n = prefetchSectionCount(prefetch);
  if (n <= 0) return false;
  let allFilled = true;
  for (let i = 0; i < n; i++) {
    if (!String(prefetch.sectionHtml[i] ?? "").trim()) {
      allFilled = false;
      break;
    }
  }
  const doneSet = new Set(prefetch.doneIdx);
  const allSectionEnds = doneSet.size >= n;
  return allFilled || allSectionEnds;
}

export function normalizeFortunePrefetchSnapshot(prefetch: FortunePrefetchV1): FortunePrefetchV1 {
  if (!inferFortunePrefetchComplete(prefetch)) return prefetch;
  if (prefetch.complete) return prefetch;
  return { ...prefetch, complete: true, updatedAt: Date.now() };
}

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
    return normalizeFortunePrefetchSnapshot(j);
  } catch {
    return null;
  }
}

export function writeFortunePrefetch(productSlug: string, payload: FortunePrefetchV1) {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeFortunePrefetchSnapshot(payload);
    sessionStorage.setItem(fortunePrefetchStorageKey(productSlug), JSON.stringify(normalized));
  } catch {
    // ignore quota
  }
}
