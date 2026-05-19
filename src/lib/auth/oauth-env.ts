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

/** 카카오는 콘솔에서 Client Secret 비활성 시 secret 없이 토큰 교환 */
export function isOAuthConfigured(provider: SocialProvider): boolean {
  if (!oauthClientId(provider)) return false;
  if (provider === "kakao") return true;
  return Boolean(oauthClientSecret(provider));
}

export function isAnyOAuthConfigured(): boolean {
  return (["google", "kakao", "naver"] as const).some(isOAuthConfigured);
}
