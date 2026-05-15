"use client";

import { supabaseBrowser } from "@/lib/supabase/client";

/** Supabase 세션 종료 후 홈으로 이동 */
export async function signOutAndGoHome(): Promise<void> {
  const sb = supabaseBrowser();
  if (sb) await sb.auth.signOut();
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.href = "/";
}
