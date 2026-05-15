import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createExchangeToken } from "@/lib/auth/exchange-token";
import { exchangeCodeAndFetchProfile } from "@/lib/auth/providers";
import {
  clearOAuthStateCookie,
  parseOAuthStateCookie,
  readOAuthStateCookie,
} from "@/lib/auth/oauth-state";
import { authErrorRedirectPath } from "@/lib/auth/redirect-errors";
import { AuthConflictError, upsertSocialUser, WithdrawalPendingError } from "@/lib/auth/social-user-service";
import type { SocialProvider } from "@/lib/auth/types";

const PROVIDERS = new Set<SocialProvider>(["google", "kakao", "naver"]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: raw } = await context.params;
  if (!PROVIDERS.has(raw as SocialProvider)) {
    return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  }
  const provider = raw as SocialProvider;

  const stored = parseOAuthStateCookie(readOAuthStateCookie(request));
  const returnTo = stored?.returnTo ?? "/";
  const fail = (code: Parameters<typeof authErrorRedirectPath>[1], extra?: { provider?: SocialProvider }) => {
    const res = NextResponse.redirect(new URL(authErrorRedirectPath(returnTo, code, extra), request.url));
    clearOAuthStateCookie(res);
    return res;
  };

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError === "access_denied" || oauthError === "user_cancelled_authorize") {
    return fail("cancelled");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state || !stored || stored.state !== state || stored.provider !== provider) {
    return fail("invalid_state");
  }

  try {
    const profile = await exchangeCodeAndFetchProfile(request, provider, code, state);
    const result = await upsertSocialUser(profile);
    const exchange = createExchangeToken({
      authUserId: result.authUserId,
      email: result.loginEmail,
      isNewUser: result.isNewUser,
    });

    const complete = new URL("/auth/complete", requestBase(request));
    complete.searchParams.set("token", exchange);
    complete.searchParams.set("returnTo", result.isNewUser ? returnTo : "/my");
    complete.searchParams.set("provider", provider);
    if (result.isNewUser) complete.searchParams.set("onboard", "1");

    const res = NextResponse.redirect(complete);
    clearOAuthStateCookie(res);
    return res;
  } catch (e) {
    if (e instanceof AuthConflictError) {
      return fail("email_provider_conflict", { provider: e.existingProvider });
    }
    if (e instanceof WithdrawalPendingError) {
      return fail("withdrawal_pending");
    }
    console.error("[auth/callback]", provider, e);
    return fail("token_failed");
  }
}

function requestBase(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}
