import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

export function supabaseServer() {
  if (!env.supabaseServiceRoleKey) {
    throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

