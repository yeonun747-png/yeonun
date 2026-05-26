/** 크레딧 충전은 로그인 계정에만 적립 — OAuth 후 복귀 경로 */
export function creditTopupLoginHref(returnTo = "/checkout/credit"): string {
  const safe = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/checkout/credit";
  return `/my?modal=auth&after_auth=${encodeURIComponent(`credit:${safe}`)}`;
}

export function parseCreditTopupAfterAuth(after: string): string | null {
  if (!after.startsWith("credit:")) return null;
  const dest = after.slice(7).trim() || "/checkout/credit";
  if (!dest.startsWith("/") || dest.startsWith("//")) return "/checkout/credit";
  return dest;
}
