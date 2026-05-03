import { cache } from "react";

import { supabaseServer } from "@/lib/supabase/server";
import {
  formatVoiceHistoryBadge,
  formatVoiceHistoryTimeLine,
  VOICE_CALL_ARCHIVE_LIST_DAYS,
  type VoiceCallHistoryRowVm,
} from "@/lib/voice-call-history-public";

export type { VoiceCallHistoryRowVm } from "@/lib/voice-call-history-public";

export {
  formatVoiceDurationKo,
  formatVoiceHistoryBadge,
  formatVoiceHistoryTimeLine,
  groupVoiceHistoryByKstMonth,
  voiceCallHistoryMonthHeading,
} from "@/lib/voice-call-history-public";

const HISTORY_DAYS = VOICE_CALL_ARCHIVE_LIST_DAYS;

/** 종료·시간이 남은 세션만 히스토리에 표시 */
export const listVoiceCallHistoryRows = cache(async (): Promise<VoiceCallHistoryRowVm[]> => {
  const supabase = supabaseServer();
  const since = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString();

  const { data: sessions, error } = await supabase
    .from("voice_sessions")
    .select("id, character_key, started_at, duration_sec, cost_krw, status, ended_at")
    .gte("started_at", since)
    .not("character_key", "is", null)
    .or("status.eq.ended,ended_at.not.is.null,duration_sec.gt.0")
    .order("started_at", { ascending: false })
    .limit(120);

  if (error) throw new Error(error.message);

  const list = sessions ?? [];
  if (list.length === 0) return [];

  const keys = [...new Set(list.map((s) => String((s as { character_key?: string }).character_key ?? "").trim()).filter(Boolean))];

  const { data: chars } = keys.length
    ? await supabase.from("characters").select("key, name").in("key", keys)
    : { data: [] as { key: string; name: string }[] };

  const nameByKey = Object.fromEntries((chars ?? []).map((c) => [c.key, c.name]));

  const rows: VoiceCallHistoryRowVm[] = [];
  for (const raw of list) {
    const r = raw as Record<string, unknown>;
    const id = String(r.id ?? "");
    if (!id) continue;
    const ck = String(r.character_key ?? "");
    const started_at = String(r.started_at ?? "");
    const duration_sec = Math.max(0, Number(r.duration_sec ?? 0));
    rows.push({
      id,
      character_key: ck,
      consultantName: nameByKey[ck] || ck,
      timeLine: formatVoiceHistoryTimeLine(started_at),
      badge: formatVoiceHistoryBadge(duration_sec),
      started_at,
    });
  }

  return rows;
});
