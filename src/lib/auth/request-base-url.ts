import type { NextRequest } from "next/server";

const PRODUCTION_HOSTS = new Set(["yeonun.com", "www.yeonun.com"]);

function isLoopbackOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".localhost");
  } catch {
    return false;
  }
}

function requestHostHeader(request: NextRequest): string {
  return (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0]?.trim() ?? "";
}

/**
 * OAuth redirect URI·완료 리다이렉트용 절대 origin.
 * 배포 환경에 `NEXTAUTH_URL=http://localhost:3000`이 남아 있으면 카카오/네이버가 동의 후
 * 사용자 브라우저를 localhost로 보내 연결이 거부됩니다. 이때는 요청 Host를 우선합니다.
 */
export function requestBaseUrl(request: NextRequest): string {
  const hostHeader = requestHostHeader(request);
  const hostLooksPublic = Boolean(hostHeader && !hostHeader.includes("localhost") && !hostHeader.startsWith("127."));

  const tryEnvOrigin = (raw: string): string | null => {
    const envUrl = String(raw ?? "").trim();
    if (!envUrl) return null;
    try {
      const origin = new URL(envUrl).origin;
      if (hostLooksPublic && isLoopbackOrigin(origin)) return null;
      return origin;
    } catch {
      return null;
    }
  };

  const fromNextAuth = tryEnvOrigin(process.env.NEXTAUTH_URL ?? "");
  if (fromNextAuth) return fromNextAuth;

  const fromSite = tryEnvOrigin(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  if (fromSite) return fromSite;

  const host = hostHeader;
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
