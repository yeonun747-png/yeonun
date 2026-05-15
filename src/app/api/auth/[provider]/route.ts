import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isOAuthConfigured } from "@/lib/auth/oauth-env";
import { createOAuthState, setOAuthStateCookie } from "@/lib/auth/oauth-state";
import { buildAuthorizeUrl } from "@/lib/auth/providers";
import { authErrorRedirectPath } from "@/lib/auth/redirect-errors";
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

  const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/";

  if (!isOAuthConfigured(provider)) {
    return NextResponse.redirect(new URL(authErrorRedirectPath(returnTo, "oauth_not_configured"), request.url));
  }

  const { state, cookieValue } = createOAuthState(provider, returnTo);
  const url = buildAuthorizeUrl(request, provider, state);
  const res = NextResponse.redirect(url);
  setOAuthStateCookie(res, cookieValue);
  return res;
}
