import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

export const supabaseBrowser = () =>
  createClient(env.supabaseUrl, env.supabaseAnonKey);

