"use client";

import { useEffect } from "react";

import { preloadContentCatalog } from "@/lib/content-catalog-cache";
import { warmJsonAuthHeaders } from "@/lib/fetch-with-auth";

/** 앱 기동 직후 풀이 카탈로그 JSON 프리로드(홈 상품 그리드·풀이 탭) */
export function ContentCatalogPreloader() {
  useEffect(() => {
    warmJsonAuthHeaders();
    void preloadContentCatalog();
  }, []);

  return null;
}
