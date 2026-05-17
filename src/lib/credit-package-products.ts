/** 마이탭 크레딧 충전 전용 — 점사 메뉴·어드민 상품 목록에서 제외 */
export const CREDIT_PACKAGE_SLUGS = [
  "credit-package-basic",
  "credit-package-popular",
  "credit-package-premium",
] as const;

export type CreditPackageSlug = (typeof CREDIT_PACKAGE_SLUGS)[number];

export function isCreditPackageProductSlug(slug: string): boolean {
  return slug.startsWith("credit-package-");
}

export function isCreditTopupProductSlug(slug: string): boolean {
  return (
    isCreditPackageProductSlug(slug) || slug.includes("voice-credit") || (slug.startsWith("credit") && slug !== "credit")
  );
}

/** 점사 메뉴·어드민 카탈로그에 노출할 상품만 */
export function isFortuneMenuCatalogProductSlug(slug: string): boolean {
  return Boolean(slug) && !isCreditPackageProductSlug(slug);
}
