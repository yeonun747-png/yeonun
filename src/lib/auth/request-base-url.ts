import type { NextRequest } from "next/server";

const PRODUCTION_HOSTS = new Set(["yeonun.com", "www.yeonun.com"]);

/** OAuth redirect URI용 절대 origin (로컬 / Vercel 프리뷰 / 실서비스) */
export function requestBaseUrl(request: NextRequest): string {
  const envUrl = String(process.env.NEXTAUTH_URL ?? "").trim();
  if (envUrl) {
    try {
      return new URL(envUrl).origin;
    } catch {
      // fall through
    }
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}`;

  return request.nextUrl.origin;
}

export function callbackUrl(request: NextRequest, provider: string): string {
  return `${requestBaseUrl(request)}/auth/callback/${provider}`;
}

export function isProductionHost(host: string): boolean {
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  return PRODUCTION_HOSTS.has(h);
}
