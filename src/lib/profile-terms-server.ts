import { supabaseServer } from "@/lib/supabase/server";

/** OAuth 약관 동의 시각 — 기존 값이 없을 때만 기록 */
export async function recordProfileTermsAcceptedAt(authUserId: string): Promise<void> {
  const uid = String(authUserId ?? "").trim();
  if (!uid) return;

  let sb;
  try {
    sb = supabaseServer();
  } catch {
    return;
  }

  const nowIso = new Date().toISOString();
  await sb.from("profiles").upsert({ id: uid }, { onConflict: "id", ignoreDuplicates: true });
  await sb.from("profiles").update({ terms_accepted_at: nowIso }).eq("id", uid).is("terms_accepted_at", null);
}
