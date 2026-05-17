"use client";

import { useEffect } from "react";

import { preloadContentCatalog } from "@/lib/content-catalog-cache";

/** 앱 기동 직후 풀이 카탈로그 JSON 프리로드(홈 상품 그리드·풀이 탭) */
export function ContentCatalogPreloader() {
  useEffect(() => {
    void preloadContentCatalog();
  }, []);

  return null;
}
