import { callbackUrl } from "@/lib/auth/request-base-url";
import { oauthClientId, oauthClientSecret } from "@/lib/auth/oauth-env";
import type { OAuthProfile, SocialProvider } from "@/lib/auth/types";
import type { NextRequest } from "next/server";

type TokenResponse = {
  access_token: string;
  id_token?: string;
};

export function buildAuthorizeUrl(request: NextRequest, provider: SocialProvider, state: string): string {
  const redirectUri = callbackUrl(request, provider);
  const clientId = oauthClientId(provider);

  if (provider === "google") {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "online",
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  if (provider === "kakao") {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
    });
    return `https://kauth.kakao.com/oauth/authorize?${params}`;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  return `https://nid.naver.com/oauth2.0/authorize?${params}`;
}

export async function exchangeCodeAndFetchProfile(
  request: NextRequest,
  provider: SocialProvider,
  code: string,
  oauthState?: string,
): Promise<OAuthProfile> {
  const redirectUri = callbackUrl(request, provider);
  const tokens = await exchangeCode(provider, code, redirectUri, oauthState);
  return fetchProfile(provider, tokens);
}

async function exchangeCode(
  provider: SocialProvider,
  code: string,
  redirectUri: string,
  oauthState?: string,
): Promise<TokenResponse> {
  const clientId = oauthClientId(provider);
  const clientSecret = oauthClientSecret(provider);

  if (provider === "google") {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const data = (await res.json()) as TokenResponse & { error?: string };
    if (!res.ok) throw new Error(data.error || "google_token_failed");
    return data;
  }

  if (provider === "kakao") {
    const res = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });
    const data = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
    if (!res.ok) throw new Error(data.error_description || data.error || "kakao_token_failed");
    return data;
  }

  const res = await fetch("https://nid.naver.com/oauth2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      state: oauthState || "",
    }),
  });
  const data = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok) throw new Error(data.error_description || data.error || "naver_token_failed");
  return data;
}

async function fetchProfile(provider: SocialProvider, tokens: TokenResponse): Promise<OAuthProfile> {
  if (provider === "google") {
    if (tokens.id_token) {
      const payload = decodeJwtPayload(tokens.id_token);
      return {
        provider,
        providerId: String(payload.sub),
        name: String(payload.name || ""),
        email: payload.email ? String(payload.email) : null,
        profileImage: payload.picture ? String(payload.picture) : null,
      };
    }
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const data = (await res.json()) as { sub?: string; name?: string; email?: string; picture?: string };
    if (!res.ok || !data.sub) throw new Error("google_profile_failed");
    return {
      provider,
      providerId: data.sub,
      name: data.name || "",
      email: data.email || null,
      profileImage: data.picture || null,
    };
  }

  if (provider === "kakao") {
    const res = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const data = (await res.json()) as {
      id?: number;
      kakao_account?: { profile?: { nickname?: string; profile_image_url?: string } };
    };
    if (!res.ok || data.id == null) throw new Error("kakao_profile_failed");
    const profile = data.kakao_account?.profile;
    return {
      provider,
      providerId: String(data.id),
      name: profile?.nickname || "카카오 사용자",
      email: null,
      profileImage: profile?.profile_image_url || null,
    };
  }

  const res = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const data = (await res.json()) as {
    resultcode?: string;
    message?: string;
    response?: { id?: string; name?: string; email?: string; profile_image?: string };
  };
  if (!res.ok || data.resultcode !== "00" || !data.response?.id) {
    throw new Error(data.message || "naver_profile_failed");
  }
  const r = data.response;
  return {
    provider,
    providerId: r.id!,
    name: r.name || "",
    email: r.email || null,
    profileImage: r.profile_image || null,
  };
}

function decodeJwtPayload(idToken: string): Record<string, unknown> {
  const part = idToken.split(".")[1];
  if (!part) throw new Error("invalid_id_token");
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}
