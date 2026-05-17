import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

import { authSecret } from "@/lib/auth/oauth-env";
import type { OAuthStatePayload, SocialProvider } from "@/lib/auth/types";

const COOKIE_NAME = "yeonun_oauth_state";
const MAX_AGE_SEC = 600;

function sign(body: string): string {
  return createHmac("sha256", authSecret()).update(body).digest("base64url");
}

export function createOAuthState(
  provider: SocialProvider,
  returnTo: string,
  opts?: { mode?: "link"; linkToAuthUserId?: string },
): { state: string; cookieValue: string } {
  const state = randomBytes(24).toString("base64url");
  const payload: OAuthStatePayload = {
    state,
    returnTo: sanitizeReturnTo(returnTo),
    provider,
    exp: Date.now() + MAX_AGE_SEC * 1000,
    ...(opts?.mode === "link" && opts.linkToAuthUserId
      ? { mode: "link" as const, linkToAuthUserId: opts.linkToAuthUserId }
      : {}),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const cookieValue = `${body}.${sign(body)}`;
  return { state, cookieValue };
}

export function parseOAuthStateCookie(cookieValue: string | undefined): OAuthStatePayload | null {
  if (!cookieValue) return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot < 1) return null;
  const body = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!payload?.state || !payload?.provider || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function setOAuthStateCookie(response: NextResponse, cookieValue: string): void {
  response.cookies.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export function clearOAuthStateCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export function readOAuthStateCookie(request: NextRequest): string | undefined {
  return request.cookies.get(COOKIE_NAME)?.value;
}

function sanitizeReturnTo(returnTo: string): string {
  const v = returnTo.trim();
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/";
  return v;
}
