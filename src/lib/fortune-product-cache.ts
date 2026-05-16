"use client";

import type { Character } from "@/lib/data/characters";
import type { Product } from "@/lib/data/content";

export type FortuneProductBundle = {
  v: 1;
  slug: string;
  product: Product;
  character: Character | null;
  fetchedAt: number;
};

const STORAGE_PREFIX = "yeonun:fortune-product:v1:";
const MAX_AGE_MS = 1000 * 60 * 30;
const MAX_MEMORY_ENTRIES = 24;

const memory = new Map<string, FortuneProductBundle>();
const inflight = new Map<string, Promise<FortuneProductBundle | null>>();

function storageKey(slug: string) {
  return `${STORAGE_PREFIX}${slug}`;
}

function trimMemory() {
  if (memory.size <= MAX_MEMORY_ENTRIES) return;
  const sorted = [...memory.entries()].sort((a, b) => b[1].fetchedAt - a[1].fetchedAt);
  memory.clear();
  for (const [k, v] of sorted.slice(0, MAX_MEMORY_ENTRIES)) memory.set(k, v);
}

function isFresh(bundle: FortuneProductBundle | null | undefined): bundle is FortuneProductBundle {
  return Boolean(bundle && Date.now() - bundle.fetchedAt < MAX_AGE_MS);
}

export function readFortuneProductCache(slug: string): FortuneProductBundle | null {
  const key = slug.trim();
  if (!key) return null;
  const mem = memory.get(key);
  if (isFresh(mem)) return mem;

  if (typeof window === "undefined") return mem ?? null;
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return mem ?? null;
    const parsed = JSON.parse(raw) as FortuneProductBundle;
    if (parsed?.v !== 1 || parsed.slug !== key || !parsed.product?.slug) return mem ?? null;
    if (!isFresh(parsed)) return mem ?? null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return mem ?? null;
  }
}

export function writeFortuneProductCache(bundle: FortuneProductBundle): void {
  const key = bundle.slug.trim();
  if (!key) return;
  memory.set(key, bundle);
  trimMemory();
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(bundle));
  } catch {
    /* quota */
  }
}

export function hasFortuneProductCache(slug: string): boolean {
  return Boolean(readFortuneProductCache(slug));
}

export function resolveInitialFortuneProduct(
  slug: string,
  serverBundle: FortuneProductBundle | null,
): FortuneProductBundle | null {
  const cached = readFortuneProductCache(slug);
  if (cached && serverBundle) {
    return serverBundle.fetchedAt >= cached.fetchedAt ? serverBundle : cached;
  }
  return cached ?? serverBundle;
}

/** 메뉴 카드 hover/touch·진입 전 풀 상품+캐릭터 JSON 프리로드 */
export function preloadFortuneProduct(slug: string, opts?: { force?: boolean }): Promise<FortuneProductBundle | null> {
  const key = slug.trim();
  if (!key) return Promise.resolve(null);

  const cached = readFortuneProductCache(key);
  if (cached && !opts?.force) return Promise.resolve(cached);

  const existing = inflight.get(key);
  if (existing) return existing;

  const task = (async () => {
    try {
      const res = await fetch(`/api/fortune/product/${encodeURIComponent(key)}`, {
        credentials: "same-origin",
      });
      if (res.status === 404) return null;
      if (!res.ok) return readFortuneProductCache(key);
      const data = (await res.json()) as FortuneProductBundle;
      if (data?.v !== 1 || data.slug !== key || !data.product?.slug) return readFortuneProductCache(key);
      const bundle: FortuneProductBundle = {
        v: 1,
        slug: key,
        product: data.product,
        character: data.character ?? null,
        fetchedAt: data.fetchedAt ?? Date.now(),
      };
      writeFortuneProductCache(bundle);
      return bundle;
    } catch {
      return readFortuneProductCache(key);
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return task;
}

/** 풀이 목록 등에서 보이는 slug 일괄 프리로드 */
export function preloadFortuneProducts(slugs: string[]): void {
  const unique = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))].slice(0, 12);
  for (const slug of unique) void preloadFortuneProduct(slug);
}
