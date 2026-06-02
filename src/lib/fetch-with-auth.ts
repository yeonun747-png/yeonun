import { supabaseBrowser } from "@/lib/supabase/client";

let authHeadersInflight: Promise<HeadersInit> | null = null;
let authHeadersCached: HeadersInit | null = null;
let authHeadersCachedAt = 0;
const AUTH_HEADERS_TTL_MS = 4 * 60 * 1000;

export function invalidateJsonAuthHeadersCache(): void {
  authHeadersCached = null;
  authHeadersCachedAt = 0;
}

const MY_API_AUTH_ERROR_KO: Record<string, string> = {
  invalid_token: "로그인이 만료되었거나 유효하지 않습니다. 로그아웃 후 다시 로그인해 주세요.",
  unauthorized: "로그인이 필요합니다.",
  account_withdrawn: "탈퇴 처리 중인 계정입니다.",
  supabase_not_configured: "서버 인증 설정이 되어 있지 않습니다.",
};

/** `/api/me/*`, `/api/my/*`, `/api/checkout/*` 등 401·invalid_token 메시지 */
export function formatMyApiAuthError(code: string): string {
  const key = String(code ?? "").trim();
  return MY_API_AUTH_ERROR_KO[key] ?? "";
}

/**
 * 서버 Route Handler용 Bearer — `getSession`만 쓰면 만료 JWT가 남을 수 있어
 * `getUser` 검증 후 필요 시 `refreshSession` 한다.
 */
export async function getBearerAccessTokenForApi(): Promise<string | null> {
  const sb = supabaseBrowser();
  if (!sb) return null;

  const { data: { session: initial } } = await sb.auth.getSession();
  if (!initial?.user) return null;

  const cachedToken = initial.access_token?.trim() || null;

  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (!userErr && userData.user) {
    const { data: { session } } = await sb.auth.getSession();
    return session?.access_token?.trim() || cachedToken;
  }

  const { data: refreshed, error: refreshErr } = await sb.auth.refreshSession();
  invalidateJsonAuthHeadersCache();
  if (!refreshErr && refreshed.session?.access_token?.trim()) {
    return refreshed.session.access_token.trim();
  }

  /** UI는 로그인인데 getUser/refresh만 실패한 경우 — 서버가 401이면 formatMyApiAuthError로 안내 */
  return cachedToken;
}

/** 로그인 시 Bearer JWT를 붙인 fetch 헤더 (비로그인은 Content-Type만) */
export async function jsonAuthHeaders(): Promise<HeadersInit> {
  if (authHeadersCached && Date.now() - authHeadersCachedAt < AUTH_HEADERS_TTL_MS) {
    return authHeadersCached;
  }
  if (authHeadersInflight) return authHeadersInflight;

  authHeadersInflight = (async () => {
    const tok = await getBearerAccessTokenForApi();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (tok) headers.Authorization = `Bearer ${tok}`;
    authHeadersCached = headers;
    authHeadersCachedAt = Date.now();
    return headers;
  })().finally(() => {
    authHeadersInflight = null;
  });

  return authHeadersInflight;
}

/** 메뉴 카드 hover 등 — 클릭 시 getSession 대기 줄이기 */
export function warmJsonAuthHeaders(): void {
  void jsonAuthHeaders();
}
