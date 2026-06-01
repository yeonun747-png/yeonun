import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { mapOAuthProviderError, mapThrownOAuthError, sanitizeAuthErrorHint } from "@/lib/auth/auth-error-hint";
import { createExchangeToken } from "@/lib/auth/exchange-token";
import { AUTH_EXCHANGE_COOKIE, AUTH_EXCHANGE_COOKIE_MAX_AGE_SEC } from "@/lib/auth/exchange-cookie";
import { exchangeCodeAndFetchProfile } from "@/lib/auth/providers";
import { callbackUrl, requestBaseUrl } from "@/lib/auth/request-base-url";
import {
  clearOAuthStateCookie,
  parseOAuthStateCookie,
  readOAuthStateCookie,
} from "@/lib/auth/oauth-state";
import { authErrorRedirectPath, socialLinkErrorRedirectPath, type AuthErrorCode } from "@/lib/auth/redirect-errors";
import {
  linkSocialProviderToUser,
  SocialLinkDisabledError,
  upsertSocialUser,
  WithdrawalPendingError,
} from "@/lib/auth/social-user-service";
import type { SocialProvider } from "@/lib/auth/types";
import { env } from "@/lib/env";
import { parseReferralPendingCookie, REFERRAL_PENDING_COOKIE } from "@/lib/referral-pending";
import { claimReferralSignup } from "@/lib/referral-server";
import { recordProfileTermsAcceptedAt } from "@/lib/profile-terms-server";

const PROVIDERS = new Set<SocialProvider>(["google", "kakao", "naver"]);

type LoginFailExtra = { provider?: SocialProvider; hint?: string };

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: raw } = await context.params;
  if (!PROVIDERS.has(raw as SocialProvider)) {
    return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  }
  const provider = raw as SocialProvider;
  const base = requestBaseUrl(request);

  const stored = parseOAuthStateCookie(readOAuthStateCookie(request));
  const returnTo = stored?.returnTo ?? "/";
  const isLinkMode = stored?.mode === "link" && Boolean(stored.linkToAuthUserId);

  const failLogin = (code: AuthErrorCode, extra?: LoginFailExtra) => {
    const path = authErrorRedirectPath(returnTo, code, { provider, ...extra });
    const res = NextResponse.redirect(new URL(path, base));
    clearOAuthStateCookie(res);
    return res;
  };

  const failLink = (code: Parameters<typeof socialLinkErrorRedirectPath>[1]) => {
    const res = NextResponse.redirect(new URL(socialLinkErrorRedirectPath(returnTo, code), base));
    clearOAuthStateCookie(res);
    return res;
  };

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    const desc = request.nextUrl.searchParams.get("error_description");
    const code = mapOAuthProviderError(oauthError, desc);
    const hint = sanitizeAuthErrorHint(desc || oauthError);
    if (code === "cancelled") {
      return isLinkMode ? failLink("cancelled") : failLogin("cancelled", { provider });
    }
    return isLinkMode ? failLink("link_failed") : failLogin(code, { provider, hint });
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state || !stored || stored.state !== state || stored.provider !== provider) {
    return isLinkMode
      ? failLink("invalid_state")
      : failLogin("invalid_state", {
          provider,
          hint: stored ? "state 불일치 또는 만료" : "로그인 쿠키 없음(차단·시크릿 모드 확인)",
        });
  }

  try {
    const profile = await exchangeCodeAndFetchProfile(request, provider, code, state);

    if (isLinkMode && stored.linkToAuthUserId) {
      await linkSocialProviderToUser(stored.linkToAuthUserId, profile);
      const done = new URL(returnTo, base);
      done.searchParams.set("social_linked", provider);
      const res = NextResponse.redirect(done);
      clearOAuthStateCookie(res);
      return res;
    }

    const result = await upsertSocialUser(profile);

    if (stored.termsAccepted) {
      await recordProfileTermsAcceptedAt(result.authUserId);
    }

    if (result.isNewUser) {
      const refRaw = request.cookies.get(REFERRAL_PENDING_COOKIE)?.value;
      const pending = parseReferralPendingCookie(refRaw);
      const serviceKey = env.supabaseServiceRoleKey;
      if (pending && serviceKey) {
        try {
          const svc = createClient(env.supabaseUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          await claimReferralSignup(svc, result.authUserId, pending.code, pending.assigned_kst_date, {
            requireNewSignup: true,
          });
        } catch (e) {
          console.warn("[auth/callback] referral claim", e);
        }
      }
    }

    const exchange = createExchangeToken({
      authUserId: result.authUserId,
      email: result.loginEmail,
      isNewUser: result.isNewUser,
    });

    const complete = new URL("/auth/complete", base);
    complete.searchParams.set("returnTo", result.isNewUser ? returnTo : "/my");
    complete.searchParams.set("provider", provider);
    if (result.isNewUser) complete.searchParams.set("onboard", "1");
    const res = NextResponse.redirect(complete);
    res.cookies.set(AUTH_EXCHANGE_COOKIE, exchange, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_EXCHANGE_COOKIE_MAX_AGE_SEC,
    });
    clearOAuthStateCookie(res);
    if (result.isNewUser) {
      res.cookies.set(REFERRAL_PENDING_COOKIE, "", { httpOnly: false, path: "/", maxAge: 0, sameSite: "lax" });
    }
    return res;
  } catch (e) {
    if (e instanceof SocialLinkDisabledError) {
      return isLinkMode ? failLink("link_disabled") : failLogin("link_failed", { provider });
    }
    if (e instanceof WithdrawalPendingError) {
      return isLinkMode ? failLink("withdrawal_pending") : failLogin("withdrawal_pending", { provider });
    }
    const mapped = mapThrownOAuthError(e);
    console.error("[auth/callback]", provider, {
      redirectUri: callbackUrl(request, provider),
      authCode: mapped.code,
      hint: mapped.hint,
      error: e,
    });
    return isLinkMode ? failLink("link_failed") : failLogin(mapped.code, { provider, hint: mapped.hint });
  }
}
