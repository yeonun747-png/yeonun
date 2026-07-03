/** 가입 혜택 프로모 시트 — 세션 1회 · 7일 dismiss */

export const SIGNUP_PROMO_POLICY_VERSION = "20260704";

const DISMISS_KEY = `yeonun:signup-promo-dismiss:v${SIGNUP_PROMO_POLICY_VERSION}`;
const SESSION_KEY = "yeonun:signup-promo-session";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function readDismissUntil(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const n = Number(raw ?? "0");
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function hasSignupPromoSessionShown(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSignupPromoSessionShown(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function hasSignupPromoDismissed(): boolean {
  return Date.now() < readDismissUntil();
}

export function dismissSignupPromoForWeek(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
  } catch {
    /* ignore */
  }
  markSignupPromoSessionShown();
}

export function canShowSignupPromo(): boolean {
  return !hasSignupPromoSessionShown() && !hasSignupPromoDismissed();
}
