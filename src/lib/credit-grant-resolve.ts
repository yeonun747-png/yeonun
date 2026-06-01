import { CREDIT_PACKAGES } from "@/lib/credit-policy";

/** 크레딧 충전 상품 slug → 서버 고정 지급량 (클라이언트 grant_base 무시) */
export function resolveCreditGrantBase(productSlug: string, amountKrw: number): number {
  const slug = productSlug.trim();
  if (slug === "credit-package-basic") return CREDIT_PACKAGES.basic.grantCredits;
  if (slug === "credit-package-popular") return CREDIT_PACKAGES.popular.grantCredits;
  if (slug === "credit-package-premium") return CREDIT_PACKAGES.premium.grantCredits;

  const suffix = slug.replace(/^credit-package-/, "") as keyof typeof CREDIT_PACKAGES;
  if (slug.startsWith("credit-package-") && suffix in CREDIT_PACKAGES) {
    return CREDIT_PACKAGES[suffix].grantCredits;
  }

  const paid = Math.floor(amountKrw);
  return paid > 0 ? paid : 0;
}
