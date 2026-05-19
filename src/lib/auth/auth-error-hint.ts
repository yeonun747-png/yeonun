import type { AuthErrorCode } from "@/lib/auth/redirect-errors";

/** URL 쿼리용 (짧게) */
export function sanitizeAuthErrorHint(raw: string): string {
  return String(raw ?? "")
    .replace(/[^\w\s가-힣.:_\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function mapOAuthProviderError(error: string, description?: string | null): AuthErrorCode {
  const blob = `${error} ${description ?? ""}`.toLowerCase();
  if (blob.includes("redirect_uri") || blob.includes("redirect uri") || blob.includes("invalid_grant")) {
    return "oauth_redirect_mismatch";
  }
  if (blob.includes("invalid_client") || blob.includes("client_secret") || blob.includes("unauthorized_client")) {
    return "oauth_invalid_client";
  }
  if (error === "access_denied" || error === "user_cancelled_authorize") {
    return "cancelled";
  }
  return "token_failed";
}

export function mapThrownOAuthError(e: unknown): { code: AuthErrorCode; hint: string } {
  const msg = e instanceof Error ? e.message : String(e);
  const hint = sanitizeAuthErrorHint(msg);
  const lower = msg.toLowerCase();
  if (lower.includes("redirect_uri") || lower.includes("invalid_grant") || lower.includes("redirect uri")) {
    return { code: "oauth_redirect_mismatch", hint };
  }
  if (lower.includes("invalid_client") || lower.includes("client_secret") || lower.includes("unauthorized_client")) {
    return { code: "oauth_invalid_client", hint };
  }
  if (lower.includes("google_token_failed") || lower.includes("kakao_token_failed")) {
    return { code: "token_failed", hint: hint || "토큰 교환 실패" };
  }
  return { code: "token_failed", hint: hint || msg.slice(0, 80) };
}

export function mapSessionApiError(error: string): AuthErrorCode {
  if (error === "invalid_token") return "token_failed";
  if (error === "account_withdrawn") return "withdrawal_pending";
  if (error === "server_misconfigured") return "oauth_not_configured";
  return "session_failed";
}
