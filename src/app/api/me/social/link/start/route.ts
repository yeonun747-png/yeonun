import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isOAuthConfigured } from "@/lib/auth/oauth-env";
import { createOAuthState, setOAuthStateCookie } from "@/lib/auth/oauth-state";
import { buildAuthorizeUrl } from "@/lib/auth/providers";
import { requireMyUserId } from "@/lib/my-route-auth";
import type { SocialProvider } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

const PROVIDERS = new Set<SocialProvider>(["google", "kakao", "naver"]);

function sanitizeReturnTo(raw: unknown): string {
  const v = String(raw ?? "/my").trim();
  if (!v.startsWith("/") || v.startsWith("//")) return "/my";
  return v;
}

export async function POST(request: NextRequest) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    provider?: string;
    returnTo?: string;
  };

  const provider = body.provider as SocialProvider;
  if (!PROVIDERS.has(provider)) {
    return NextResponse.json({ ok: false, error: "invalid_provider" }, { status: 400 });
  }

  if (!isOAuthConfigured(provider)) {
    return NextResponse.json({ ok: false, error: "oauth_not_configured" }, { status: 503 });
  }

  const returnTo = sanitizeReturnTo(body.returnTo);
  const { state, cookieValue } = createOAuthState(provider, returnTo, {
    mode: "link",
    linkToAuthUserId: auth.userId,
  });

  const url = buildAuthorizeUrl(request, provider, state);
  const res = NextResponse.json({ ok: true, url });
  setOAuthStateCookie(res, cookieValue);
  return res;
}
