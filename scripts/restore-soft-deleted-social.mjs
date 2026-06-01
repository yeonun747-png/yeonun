/**
 * 탈퇴 유예(soft delete) 테스트 계정 복구
 * Usage: node --env-file=.env.local scripts/restore-soft-deleted-social.mjs [email]
 * Example: node --env-file=.env.local scripts/restore-soft-deleted-social.mjs goricc@naver.com
 */
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] || "goricc@naver.com").trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: hits, error: findErr } = await sb
  .from("yeonun_social_users")
  .select("id,auth_user_id,provider,provider_id,email,deleted_at")
  .ilike("email", email);

if (findErr) {
  console.error(findErr.message);
  process.exit(1);
}

const deleted = (hits ?? []).filter((r) => r.deleted_at);
if (!deleted.length) {
  console.log(`No soft-deleted yeonun_social_users for email=${email}`);
  console.log("Rows found:", hits ?? []);
  process.exit(0);
}

const authIds = [...new Set(deleted.map((r) => r.auth_user_id).filter(Boolean))];
console.log("Restore auth_user_id(s):", authIds);

const { data: restored, error: upErr } = await sb
  .from("yeonun_social_users")
  .update({ deleted_at: null, purge_after_at: null })
  .in("auth_user_id", authIds)
  .select("id,provider,email,deleted_at");

if (upErr) {
  console.error(upErr.message);
  process.exit(1);
}

console.log("Restored rows:", restored);
