import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 브라우저 전용. `env.ts`의 즉시 throw를 피해, 공개 키가 없으면 null.
 * (로컬에서 Supabase 미설정일 때도 오늘 탭 등이 로드되도록)
 */
function readBrowserSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

const BROWSER_SINGLETON_KEY = "__yeonun_supabase_browser_v1__" as const;

/**
 * 동일 탭에서 **단일** Supabase 클라이언트(= 단일 GoTrueClient).
 * 매 호출마다 `createClient` 하면 같은 storage 키로 여러 GoTrue 인스턴스가 생겨
 * 경고·락 경합·출석 sync 등 `getSession` 지연이 날 수 있음.
 */
export function supabaseBrowser(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const cfg = readBrowserSupabaseConfig();
  const w = window as unknown as Record<string, SupabaseClient | null | undefined>;
  if (!cfg) {
    w[BROWSER_SINGLETON_KEY] = null;
    return null;
  }
  const hit = w[BROWSER_SINGLETON_KEY];
  if (hit) return hit;
  const client = createClient(cfg.url, cfg.anonKey);
  w[BROWSER_SINGLETON_KEY] = client;
  return client;
}
