import { ORDER_ACCESS_TOKEN_HEADER } from "@/lib/order-access-constants";
import { readPgPendingSession } from "@/lib/payment-return-bridge";

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
