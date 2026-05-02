import { cache } from "react";

import { supabaseServer } from "@/lib/supabase/server";
import {
  formatVoiceHistoryBadge,
  formatVoiceHistoryTimeLine,
  pickVoiceResultSnippet,
  type VoiceCallHistoryRowVm,
} from "@/lib/voice-call-history-public";

export type { VoiceCallHistoryRowVm } from "@/lib/voice-call-history-public";

export {
  formatVoiceDurationKo,
  formatVoiceHistoryBadge,
  formatVoiceHistoryTimeLine,
  groupVoiceHistoryByKstMonth,
  pickVoiceResultSnippet,
  voiceCallHistoryMonthHeading,
} from "@/lib/voice-call-history-public";

const HISTORY_DAYS = 90;

/** 종료·시간이 남은 세션만 히스토리에 표시 */
export const listVoiceCallHistoryRows = cache(async (): Promise<VoiceCallHistoryRowVm[]> => {
  const supabase = supabaseServer();
  const since = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString();

  const { data: sessions, error } = await supabase
    .from("voice_sessions")
    .select("id, character_key, started_at, duration_sec, cost_krw, summary, memory_summary, status, ended_at")
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
    const cost_krw = Math.max(0, Number(r.cost_krw ?? 0));

    rows.push({
      id,
      character_key: ck,
      consultantName: nameByKey[ck] || ck,
      timeLine: formatVoiceHistoryTimeLine(started_at),
      badge: formatVoiceHistoryBadge(duration_sec, cost_krw),
      resultSnippet: pickVoiceResultSnippet(
        r.summary != null ? String(r.summary) : null,
        r.memory_summary != null ? String(r.memory_summary) : null,
      ),
      started_at,
    });
  }

  const missingSnippetIds = rows.filter((row) => !row.resultSnippet).map((row) => row.id);
  if (missingSnippetIds.length > 0) {
    const { data: turns } = await supabase
      .from("voice_turns")
      .select("session_id, text, created_at")
      .in("session_id", missingSnippetIds)
      .eq("role", "assistant")
      .order("created_at", { ascending: false });

    const seen = new Set<string>();
    const snippetBySession: Record<string, string> = {};
    for (const t of turns ?? []) {
      const row = t as { session_id?: string; text?: string | null };
      const sid = String(row.session_id ?? "");
      if (!sid || seen.has(sid)) continue;
      seen.add(sid);
      const tx = String(row.text ?? "").trim();
      if (tx) snippetBySession[sid] = tx.length > 280 ? `${tx.slice(0, 277)}…` : tx;
    }
    for (const row of rows) {
      if (!row.resultSnippet && snippetBySession[row.id]) {
        row.resultSnippet = snippetBySession[row.id];
      }
    }
  }

  return rows;
});
