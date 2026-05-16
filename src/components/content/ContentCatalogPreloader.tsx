"use client";

import { useEffect } from "react";

import { preloadContentCatalog } from "@/lib/content-catalog-cache";

/** 앱 기동 후 idle에 풀이 카탈로그 JSON을 미리 받아 둠 */
export function ContentCatalogPreloader() {
  useEffect(() => {
    const run = () => {
      void preloadContentCatalog();
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(run, 400);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
