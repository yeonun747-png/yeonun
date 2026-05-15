import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/** 서버 전용: magic link OTP로 Supabase 세션 토큰 발급 */
export async function mintSupabaseSessionTokens(email: string): Promise<{
  access_token: string;
  refresh_token: string;
}> {
  const serviceKey = env.supabaseServiceRoleKey;
  if (!serviceKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(env.supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;

  const tokenHash = link.properties?.hashed_token;
  if (!tokenHash) throw new Error("magiclink_hash_missing");

  const { data: verified, error: verifyErr } = await admin.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (verifyErr) throw verifyErr;
  if (!verified.session?.access_token || !verified.session?.refresh_token) {
    throw new Error("session_tokens_missing");
  }

  return {
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
  };
}
