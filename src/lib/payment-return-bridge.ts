/** PG 성공/실패 팝업 ↔ 결제 요청 창(opener) 연동 — 크로스 도메인(reunion.fortune82.com 등) 대응 */

export const YEONUN_PAYMENT_SUCCESS_MSG = "yeonun:payment:success";
export const YEONUN_PAYMENT_ERROR_MSG = "yeonun:payment:error";

const LOCAL_PAYMENT_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
];

/** PG 리다이렉트·postMessage에 쓸 연운 정식 사이트 origin */
export function getCanonicalPaymentOrigin(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yeonun.com").trim().replace(/\/$/, "");
  if (fromEnv.startsWith("http://") || fromEnv.startsWith("https://")) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      /* fall through */
    }
  }
  return "https://www.yeonun.com";
}

export function getPaymentOpenerTargetOrigins(): string[] {
  const canonical = getCanonicalPaymentOrigin();
  const set = new Set<string>([
    canonical,
    "https://www.yeonun.com",
    "https://yeonun.com",
    ...LOCAL_PAYMENT_ORIGINS,
  ]);
  if (typeof window !== "undefined") {
    set.add(window.location.origin);
  }
  return [...set];
}

/** fortune82 재회 도메인 등 PG 고정 리턴 URL → 연운 canonical로 이동 */
export function shouldRedirectPaymentReturnToCanonical(): boolean {
  if (typeof window === "undefined") return false;
  const canonical = getCanonicalPaymentOrigin();
  if (window.location.origin === canonical) return false;
  const host = window.location.hostname.toLowerCase();
  if (host.endsWith("fortune82.com") || host.endsWith("yeonun.com")) return true;
  return false;
}

export function canonicalPaymentReturnUrl(path: "/payment/success" | "/payment/error", search: string): string {
  const base = getCanonicalPaymentOrigin();
  return `${base}${path}${search.startsWith("?") ? search : search ? `?${search}` : ""}`;
}

export function postPaymentResultToOpener(payload: {
  type: typeof YEONUN_PAYMENT_SUCCESS_MSG | typeof YEONUN_PAYMENT_ERROR_MSG;
  oid?: string;
  ok?: boolean;
  code?: string;
  msg?: string;
}): void {
  if (typeof window === "undefined" || !window.opener || window.opener.closed) return;
  for (const origin of getPaymentOpenerTargetOrigins()) {
    try {
      window.opener.postMessage(payload, origin);
    } catch {
      /* ignore */
    }
  }
}

export function isTrustedPaymentOpenerMessage(event: MessageEvent): boolean {
  if (!event?.data || typeof event.data !== "object") return false;
  const type = (event.data as { type?: string }).type;
  if (type !== YEONUN_PAYMENT_SUCCESS_MSG && type !== YEONUN_PAYMENT_ERROR_MSG) return false;
  const origins = getPaymentOpenerTargetOrigins();
  return origins.includes(event.origin);
}
