import { jsonAuthHeaders } from "@/lib/fetch-with-auth";
import { ORDER_ACCESS_TOKEN_HEADER } from "@/lib/order-access-constants";
import { readPgPendingSession } from "@/lib/payment-return-bridge";

const ORDER_ACCESS_ERROR_KO: Record<string, string> = {
  order_forbidden: "결제 권한을 확인하지 못했습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요.",
  order_not_found: "주문 정보를 찾을 수 없습니다. 처음부터 다시 시도해 주세요.",
  order_not_paid: "결제가 완료되지 않았습니다.",
};

export function formatOrderAccessError(code: string): string {
  const key = String(code ?? "").trim();
  return ORDER_ACCESS_ERROR_KO[key] ?? (key || "결제 요청 중 오류가 발생했습니다.");
}

const LS_PREFIX = "yeonun:order-access:";

export function storeOrderAccessToken(orderNo: string, token: string): void {
  const oid = String(orderNo ?? "").trim();
  const tok = String(token ?? "").trim();
  if (!oid || !tok || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${LS_PREFIX}${oid}`, tok);
    localStorage.setItem(`${LS_PREFIX}${oid}`, tok);
  } catch {
    /* ignore */
  }
}

export function readOrderAccessToken(orderNo?: string | null): string | null {
  const oid = String(orderNo ?? "").trim();
  if (!oid || typeof window === "undefined") return null;
  try {
    const fromSession = sessionStorage.getItem(`${LS_PREFIX}${oid}`)?.trim();
    if (fromSession) return fromSession;
    const fromLocal = localStorage.getItem(`${LS_PREFIX}${oid}`)?.trim();
    if (fromLocal) return fromLocal;
    const pending = readPgPendingSession(oid);
    const tok = String(pending?.orderAccessToken ?? "").trim();
    return tok || null;
  } catch {
    return null;
  }
}

export function orderAccessHeaders(orderNo?: string | null): HeadersInit {
  const tok = readOrderAccessToken(orderNo);
  if (!tok) return {};
  return { [ORDER_ACCESS_TOKEN_HEADER]: tok };
}

/** PG·점사 API — HMAC 토큰 + 로그인 JWT(주문 소유권) 병합 */
export async function orderAccessAuthHeaders(orderNo?: string | null): Promise<HeadersInit> {
  const auth = (await jsonAuthHeaders()) as Record<string, string>;
  const tok = readOrderAccessToken(orderNo);
  if (tok) auth[ORDER_ACCESS_TOKEN_HEADER] = tok;
  return auth;
}
