"use client";

import { useEffect } from "react";

/** 홈·풀이 목록에서 `#home-product-*` / `#content-product-*` 진입 시 해당 카드로 스크롤 */
export function ScrollToProductHash() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash.startsWith("home-product-") && !hash.startsWith("content-product-")) return undefined;

    const scrollToId = () => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    scrollToId();
    const t1 = window.setTimeout(scrollToId, 120);
    const t2 = window.setTimeout(scrollToId, 420);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);
  return null;
}
