import { createClient } from "@supabase/supabase-js";

function env(): { url: string; anonKey: string } | null {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** Route Handler: Authorization Bearer JWT 로 사용자 컨텍스트 클라이언트 */
export function supabaseRouteUserClient(accessToken: string) {
  const cfg = env();
  if (!cfg) return null;
  return createClient(cfg.url, cfg.anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function bearerFromRequest(request: Request): string | null {
  const h = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!h?.toLowerCase().startsWith("bearer ")) return null;
  const t = h.slice(7).trim();
  return t || null;
}
