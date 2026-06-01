import type { SupabaseClient } from "@supabase/supabase-js";

import { formatKstDateKey } from "@/lib/datetime/kst";

const M04_CHAR_KEYS = ["yeon", "byeol", "yeo", "un"] as const;

/** 클라이언트 markMissionFact prefix → DB event_key */
export function normalizeMissionEventKey(raw: string): string | null {
  const key = String(raw ?? "").trim();
  if (!key) return null;

  if (/^m0[3-9]-/.test(key) || /^m1[0-2]-/.test(key)) return key;
  if (key.startsWith("m04-card:")) {
    const ck = key.slice("m04-card:".length);
    if (M04_CHAR_KEYS.includes(ck as (typeof M04_CHAR_KEYS)[number])) return key;
  }
  return null;
}

export async function recordUserMissionEvent(
  supabase: SupabaseClient,
  userId: string,
  eventKey: string,
  kstDate: string,
): Promise<void> {
  const normalized = normalizeMissionEventKey(eventKey);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(kstDate)) return;

  await supabase.from("user_mission_event_logs").upsert(
    {
      user_id: userId,
      event_key: normalized,
      kst_date: kstDate,
    },
    { onConflict: "user_id,event_key,kst_date", ignoreDuplicates: true },
  );
}

export async function hasUserMissionEvent(
  supabase: SupabaseClient,
  userId: string,
  eventKey: string,
  kstDate: string,
): Promise<boolean> {
  const normalized = normalizeMissionEventKey(eventKey);
  if (!normalized) return false;
  const { count } = await supabase
    .from("user_mission_event_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_key", normalized)
    .eq("kst_date", kstDate);
  return (count ?? 0) > 0;
}

export async function hasUserMissionM04Complete(
  supabase: SupabaseClient,
  userId: string,
  kstDate: string,
): Promise<boolean> {
  if (await hasUserMissionEvent(supabase, userId, "m04-daily-words", kstDate)) return true;
  for (const ck of M04_CHAR_KEYS) {
    if (!(await hasUserMissionEvent(supabase, userId, `m04-card:${ck}`, kstDate))) return false;
  }
  return true;
}

export function kstDateForMissionWindow(now = new Date()): string {
  return formatKstDateKey(now);
}

export function hours24SinceIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}
