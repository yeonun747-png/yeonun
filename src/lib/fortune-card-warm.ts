"use client";

import { preloadFortuneProduct } from "@/lib/fortune-product-cache";
import { preloadFortuneDuplicateCheck } from "@/lib/fortune-duplicate-client";

/** 메뉴 카드 hover/touch — 점사 진입·중복 팝업 지연 최소화 */
export function warmFortuneMenuCard(slug: string, href: string): void {
  const key = slug.trim();
  if (!key) return;

  void preloadFortuneProduct(key);
  void import("@/components/fortune/FortunePage");
  preloadFortuneDuplicateCheck(key);

  if (typeof document === "undefined") return;
  const id = `yeonun-prefetch-fortune-${key}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "prefetch";
  link.as = "document";
  link.href = href;
  document.head.appendChild(link);
}
