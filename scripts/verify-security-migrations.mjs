/**
 * 보안 migration 프로덕션 적용 여부 점검
 * Usage: node scripts/verify-security-migrations.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const checks = [
  {
    name: "reviews RLS (published only)",
    async run() {
      const { data, error } = await sb.from("reviews").select("id, is_published").limit(1);
      if (error) throw error;
      return data?.every((r) => r.is_published === true) ?? true;
    },
  },
  {
    name: "profiles.terms_accepted_at",
    async run() {
      const { error } = await sb.from("profiles").select("terms_accepted_at").limit(0);
      if (error?.message?.includes("terms_accepted_at")) return false;
      if (error) throw error;
      return true;
    },
  },
  {
    name: "profiles.saju_consent_at",
    async run() {
      const { error } = await sb.from("profiles").select("saju_consent_at").limit(0);
      if (error?.message?.includes("saju_consent_at")) return false;
      if (error) throw error;
      return true;
    },
  },
  {
    name: "user_mission_event_logs",
    async run() {
      const { error } = await sb.from("user_mission_event_logs").select("id").limit(0);
      if (error?.message?.includes("user_mission_event_logs")) return false;
      if (error) throw error;
      return true;
    },
  },
  {
    name: "api_rate_limit_buckets + try_rate_limit_hit",
    async run() {
      const { error: tErr } = await sb.from("api_rate_limit_buckets").select("bucket_key").limit(0);
      if (tErr?.message?.includes("api_rate_limit_buckets")) return false;
      if (tErr) throw tErr;
      const { error: rpcErr } = await sb.rpc("try_rate_limit_hit", {
        p_bucket_key: "__verify__",
        p_window_start: new Date().toISOString(),
        p_limit: 1,
      });
      if (rpcErr?.message?.includes("try_rate_limit_hit")) return false;
      if (rpcErr) throw rpcErr;
      return true;
    },
  },
];

let failed = 0;
for (const c of checks) {
  try {
    const ok = await c.run();
    console.log(ok ? `OK  ${c.name}` : `FAIL ${c.name}`);
    if (!ok) failed += 1;
  } catch (e) {
    console.log(`ERR ${c.name}:`, e instanceof Error ? e.message : e);
    failed += 1;
  }
}

process.exit(failed > 0 ? 1 : 0);
