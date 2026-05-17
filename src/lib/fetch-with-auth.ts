import { supabaseBrowser } from "@/lib/supabase/client";

/** 로그인 시 Bearer JWT를 붙인 fetch 헤더 (비로그인은 Content-Type만) */
export async function jsonAuthHeaders(): Promise<HeadersInit> {
  const sb = supabaseBrowser();
  const tok = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (tok) headers.Authorization = `Bearer ${tok}`;
  return headers;
}
