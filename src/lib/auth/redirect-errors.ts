import type { SocialProvider } from "@/lib/auth/types";

export type AuthErrorCode =
  | "cancelled"
  | "oauth_not_configured"
  | "oauth_redirect_mismatch"
  | "oauth_invalid_client"
  | "invalid_state"
  | "token_failed"
  | "session_failed"
  | "email_provider_conflict"
  | "withdrawal_pending"
  | "link_failed"
  | "unknown";

export type SocialLinkErrorCode =
  | "cancelled"
  | "invalid_state"
  | "withdrawal_pending"
  | "link_failed"
  | "link_disabled";

export function socialLinkErrorRedirectPath(returnTo: string, code: SocialLinkErrorCode): string {
  const url = new URL(returnTo.startsWith("/") ? returnTo : "/", "http://local");
  url.searchParams.set("social_link_error", code);
  return `${url.pathname}${url.search}`;
}

export function authErrorRedirectPath(
  returnTo: string,
  code: AuthErrorCode,
  extra?: { provider?: SocialProvider; hint?: string },
): string {
  const base = returnTo.includes("?") ? returnTo : returnTo;
  const url = new URL(base, "http://local");
  url.searchParams.set("modal", "auth");
  url.searchParams.set("auth_error", code);
  if (extra?.provider) url.searchParams.set("auth_error_provider", extra.provider);
  if (extra?.hint) url.searchParams.set("auth_error_hint", extra.hint);
  return `${url.pathname}${url.search}`;
}
