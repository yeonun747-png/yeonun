/** PG 성공/실패 팝업 ↔ 결제 요청 창(opener) 연동 — 크로스 도메인(reunion.fortune82.com 등) 대응 */

export const YEONUN_PAYMENT_SUCCESS_MSG = "yeonun:payment:success";
export const YEONUN_PAYMENT_ERROR_MSG = "yeonun:payment:error";

export const PAYMENT_SUCCESS_OID_KEY = "payment_success_oid";
export const PAYMENT_SUCCESS_TS_KEY = "payment_success_timestamp";
export const PAYMENT_SUCCESS_SIGNAL_KEY = "payment_success_signal";
export const PAYMENT_PENDING_SESSION_KEY = "yeonun_pg_pending_v1";

export type PgPendingSession = {
  orderNo: string;
  productSlug: string;
  returnHref: string;
};

/** 결제 팝업이 다른 탭에 기록한 성공 신호 — 부모 창 storage 이벤트·폴링용 */
export function signalPaymentSuccessStorage(oid: string): void {
  if (typeof window === "undefined") return;
  const id = String(oid ?? "").trim();
  if (!id) return;
  try {
    localStorage.setItem(PAYMENT_SUCCESS_OID_KEY, id);
    localStorage.setItem(PAYMENT_SUCCESS_TS_KEY, Date.now().toString());
    localStorage.setItem(PAYMENT_SUCCESS_SIGNAL_KEY, `${id}:${Date.now()}:${Math.random().toString(16).slice(2)}`);
  } catch {
    /* ignore */
  }
}

export function readPaymentSuccessOidFromStorage(maxAgeMs = 30 * 60 * 1000): string | null {
  if (typeof window === "undefined") return null;
  try {
    const oid = localStorage.getItem(PAYMENT_SUCCESS_OID_KEY)?.trim();
    if (!oid) return null;
    const ts = Number(localStorage.getItem(PAYMENT_SUCCESS_TS_KEY) ?? 0);
    if (ts > 0 && Date.now() - ts > maxAgeMs) return null;
    return oid;
  } catch {
    return null;
  }
}

export function clearPaymentSuccessStorage(): void {
  try {
    localStorage.removeItem(PAYMENT_SUCCESS_OID_KEY);
    localStorage.removeItem(PAYMENT_SUCCESS_TS_KEY);
    localStorage.removeItem(PAYMENT_SUCCESS_SIGNAL_KEY);
  } catch {
    /* ignore */
  }
}

export function writePgPendingSession(session: PgPendingSession): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PAYMENT_PENDING_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function readPgPendingSession(): PgPendingSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PAYMENT_PENDING_SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as PgPendingSession;
    if (!o?.orderNo || !o?.productSlug || !o?.returnHref) return null;
    return o;
  } catch {
    return null;
  }
}

export function clearPgPendingSession(): void {
  try {
    sessionStorage.removeItem(PAYMENT_PENDING_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

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
