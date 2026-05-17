import type { SocialProvider } from "@/lib/auth/types";

export type AuthErrorCode =
  | "cancelled"
  | "oauth_not_configured"
  | "invalid_state"
  | "token_failed"
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

export function authErrorRedirectPath(returnTo: string, code: AuthErrorCode, extra?: { provider?: SocialProvider }): string {
  const base = returnTo.includes("?") ? returnTo : returnTo;
  const url = new URL(base, "http://local");
  url.searchParams.set("modal", "auth");
  url.searchParams.set("auth_error", code);
  if (extra?.provider) url.searchParams.set("auth_error_provider", extra.provider);
  return `${url.pathname}${url.search}`;
}
