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

export function supabaseBrowser(): SupabaseClient | null {
  const cfg = readBrowserSupabaseConfig();
  if (!cfg) return null;
  return createClient(cfg.url, cfg.anonKey);
}
