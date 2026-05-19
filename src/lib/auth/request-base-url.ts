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

function requestHostname(request: NextRequest): string {
  return requestHostHeader(request).split(":")[0]?.toLowerCase() ?? "";
}

function originFromHostname(request: NextRequest, hostname: string): string {
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (hostname === "localhost" || hostname === "127.0.0.1" ? "http" : "https");
  return `${proto}://${hostname}`;
}

/**
 * OAuth redirect URI·완료 리다이렉트용 절대 origin.
 * - yeonun.com / www.yeonun.com: 요청 Host 우선 (콘솔 등록 URI와 일치)
 * - `NEXTAUTH_URL=http://localhost:3000`이 프로덕션에 남아 있어도 loopback은 무시
 */
export function requestBaseUrl(request: NextRequest): string {
  const hostname = requestHostname(request);
  if (PRODUCTION_HOSTS.has(hostname)) {
    return originFromHostname(request, hostname);
  }

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

  if (hostname) return originFromHostname(request, hostname);

  return request.nextUrl.origin;
}

export function callbackUrl(request: NextRequest, provider: string): string {
  return `${requestBaseUrl(request)}/auth/callback/${provider}`;
}

export function isProductionHost(host: string): boolean {
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  return PRODUCTION_HOSTS.has(h);
}
