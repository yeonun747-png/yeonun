import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createExchangeToken } from "@/lib/auth/exchange-token";
import { exchangeCodeAndFetchProfile } from "@/lib/auth/providers";
import { requestBaseUrl } from "@/lib/auth/request-base-url";
import {
  clearOAuthStateCookie,
  parseOAuthStateCookie,
  readOAuthStateCookie,
} from "@/lib/auth/oauth-state";
import { authErrorRedirectPath, socialLinkErrorRedirectPath } from "@/lib/auth/redirect-errors";
import {
  linkSocialProviderToUser,
  SocialLinkDisabledError,
  upsertSocialUser,
  WithdrawalPendingError,
} from "@/lib/auth/social-user-service";
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
  const isLinkMode = stored?.mode === "link" && Boolean(stored.linkToAuthUserId);

  const failLogin = (code: Parameters<typeof authErrorRedirectPath>[1]) => {
    const res = NextResponse.redirect(new URL(authErrorRedirectPath(returnTo, code), request.url));
    clearOAuthStateCookie(res);
    return res;
  };

  const failLink = (code: Parameters<typeof socialLinkErrorRedirectPath>[1]) => {
    const res = NextResponse.redirect(new URL(socialLinkErrorRedirectPath(returnTo, code), request.url));
    clearOAuthStateCookie(res);
    return res;
  };

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError === "access_denied" || oauthError === "user_cancelled_authorize") {
    return isLinkMode ? failLink("cancelled") : failLogin("cancelled");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state || !stored || stored.state !== state || stored.provider !== provider) {
    return isLinkMode ? failLink("invalid_state") : failLogin("invalid_state");
  }

  try {
    const profile = await exchangeCodeAndFetchProfile(request, provider, code, state);

    if (isLinkMode && stored.linkToAuthUserId) {
      await linkSocialProviderToUser(stored.linkToAuthUserId, profile);
      const done = new URL(returnTo, requestBaseUrl(request));
      done.searchParams.set("social_linked", provider);
      const res = NextResponse.redirect(done);
      clearOAuthStateCookie(res);
      return res;
    }

    const result = await upsertSocialUser(profile);
    const exchange = createExchangeToken({
      authUserId: result.authUserId,
      email: result.loginEmail,
      isNewUser: result.isNewUser,
    });

    const complete = new URL("/auth/complete", requestBaseUrl(request));
    complete.searchParams.set("token", exchange);
    complete.searchParams.set("returnTo", result.isNewUser ? returnTo : "/my");
    complete.searchParams.set("provider", provider);
    if (result.isNewUser) complete.searchParams.set("onboard", "1");
    const res = NextResponse.redirect(complete);
    clearOAuthStateCookie(res);
    return res;
  } catch (e) {
    if (e instanceof SocialLinkDisabledError) {
      return isLinkMode ? failLink("link_disabled") : failLogin("link_failed");
    }
    if (e instanceof WithdrawalPendingError) {
      return isLinkMode ? failLink("withdrawal_pending") : failLogin("withdrawal_pending");
    }
    console.error("[auth/callback]", provider, e);
    return isLinkMode ? failLink("link_failed") : failLogin("token_failed");
  }
}
