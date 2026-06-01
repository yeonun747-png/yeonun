import { supabaseBrowser } from "@/lib/supabase/client";

let authHeadersInflight: Promise<HeadersInit> | null = null;
let authHeadersCached: HeadersInit | null = null;
let authHeadersCachedAt = 0;
const AUTH_HEADERS_TTL_MS = 4 * 60 * 1000;

/** 로그인 시 Bearer JWT를 붙인 fetch 헤더 (비로그인은 Content-Type만) */
export async function jsonAuthHeaders(): Promise<HeadersInit> {
  if (authHeadersCached && Date.now() - authHeadersCachedAt < AUTH_HEADERS_TTL_MS) {
    return authHeadersCached;
  }
  if (authHeadersInflight) return authHeadersInflight;

  authHeadersInflight = (async () => {
    const sb = supabaseBrowser();
    const tok = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
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
