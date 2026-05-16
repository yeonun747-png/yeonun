"use client";

import type { ContentCatalogSnapshot } from "@/lib/content-catalog";

const STORAGE_KEY = "yeonun:content-catalog:v1";
const MAX_AGE_MS = 1000 * 60 * 30;

let memory: ContentCatalogSnapshot | null = null;
let inflight: Promise<ContentCatalogSnapshot | null> | null = null;

export function hasContentCatalogCache(): boolean {
  const c = readContentCatalogCache();
  return Boolean(c && c.products.length > 0);
}

/** 클라이언트 마운트 시 서버 스냅샷과 캐시 중 즉시 그릴 데이터 선택 */
export function resolveInitialContentCatalog(serverCatalog: ContentCatalogSnapshot): ContentCatalogSnapshot {
  const cached = readContentCatalogCache();
  if (cached && cached.products.length > 0) {
    if (!serverCatalog.products.length) return cached;
    return serverCatalog.fetchedAt >= cached.fetchedAt ? serverCatalog : cached;
  }
  return serverCatalog;
}

export function readContentCatalogCache(): ContentCatalogSnapshot | null {
  if (memory && Date.now() - memory.fetchedAt < MAX_AGE_MS) return memory;
  if (typeof window === "undefined") return memory;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return memory;
    const parsed = JSON.parse(raw) as ContentCatalogSnapshot;
    if (parsed?.v !== 1 || !Array.isArray(parsed.products) || !Array.isArray(parsed.categories)) {
      return memory;
    }
    if (Date.now() - (parsed.fetchedAt ?? 0) > MAX_AGE_MS) return memory;
    memory = parsed;
    return parsed;
  } catch {
    return memory;
  }
}

export function writeContentCatalogCache(snapshot: ContentCatalogSnapshot): void {
  memory = snapshot;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota */
  }
}

/** 풀이 탭 진입 전 카탈로그 JSON 프리로드 — BottomNav·앱 idle에서 호출 */
export function preloadContentCatalog(opts?: { force?: boolean }): Promise<ContentCatalogSnapshot | null> {
  const cached = readContentCatalogCache();
  if (cached && !opts?.force) return Promise.resolve(cached);

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/content/catalog", { credentials: "same-origin" });
      if (!res.ok) return readContentCatalogCache();
      const data = (await res.json()) as ContentCatalogSnapshot;
      if (data?.v !== 1 || !Array.isArray(data.products)) return readContentCatalogCache();
      writeContentCatalogCache(data);
      return data;
    } catch {
      return readContentCatalogCache();
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
