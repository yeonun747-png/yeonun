import type { SocialProvider } from "@/lib/auth/types";

function read(name: string): string {
  return String(process.env[name] ?? "").trim();
}

export function authSecret(): string {
  const v = read("NEXTAUTH_SECRET") || read("JWT_SECRET");
  if (!v) throw new Error("Missing env: NEXTAUTH_SECRET (or JWT_SECRET)");
  return v;
}

export function oauthClientId(provider: SocialProvider): string {
  if (provider === "google") return read("GOOGLE_CLIENT_ID");
  if (provider === "kakao") return read("KAKAO_CLIENT_ID");
  return read("NAVER_CLIENT_ID");
}

export function oauthClientSecret(provider: SocialProvider): string {
  if (provider === "google") return read("GOOGLE_CLIENT_SECRET");
  if (provider === "kakao") return read("KAKAO_CLIENT_SECRET");
  return read("NAVER_CLIENT_SECRET");
}

export function isOAuthConfigured(provider: SocialProvider): boolean {
  return Boolean(oauthClientId(provider) && oauthClientSecret(provider));
}

export function isAnyOAuthConfigured(): boolean {
  return (["google", "kakao", "naver"] as const).some(isOAuthConfigured);
}
