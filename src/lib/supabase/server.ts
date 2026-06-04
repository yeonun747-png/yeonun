import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * service_role 클라이언트는 요청별 인증 상태가 없으므로 안전하게 재사용한다.
 * 매 호출마다 createClient(새 연결/TLS 핸드셰이크)를 만들면 점사 게이트·조회 왕복이
 * 누적되어 스트림 시작이 느려진다 → 모듈 싱글톤으로 캐시한다.
 */
let cachedClient: SupabaseClient | null = null;

export function supabaseServer(): SupabaseClient {
  if (!env.supabaseServiceRoleKey) {
    throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  }
  if (cachedClient) return cachedClient;
  cachedClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
  return cachedClient;
}

