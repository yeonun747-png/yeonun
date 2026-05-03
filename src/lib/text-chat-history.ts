import { cache } from "react";

import type { TextChatDetail, TextChatListRow, TextChatMessageRow } from "@/lib/text-chat-history-public";
import { isUuidSessionId } from "@/lib/text-chat-history-public";
import { VOICE_CALL_ARCHIVE_LIST_DAYS } from "@/lib/voice-call-history-public";
import { supabaseServer } from "@/lib/supabase/server";

export type { TextChatDetail, TextChatListRow, TextChatMessageRow, TextChatMessageGroupedDay } from "@/lib/text-chat-history-public";

export {
  formatKstAmpmHm,
  formatKstHistoryDayTitle,
  formatKstYmdDots,
  formatTextChatListDayDot,
  groupTextChatMessagesByKstDay,
  groupTextChatRowsByKstMonth,
  isUuidSessionId,
  textChatListMonthHeading,
} from "@/lib/text-chat-history-public";

const HISTORY_DAYS = VOICE_CALL_ARCHIVE_LIST_DAYS;
/** 상세·목록 메타 보관일 안내(음성 세션은 DB 컬럼 없음 → 종료/시작 +60일, 점사 보관함과 통일) */
const RETENTION_DISPLAY_DAYS = VOICE_CALL_ARCHIVE_LIST_DAYS;

function historySinceIso(): string {
  return new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString();
}

function retentionFromVoiceAnchor(endedAt: string | null, startedAt: string): string {
  const endMs = endedAt ? Date.parse(endedAt) : NaN;
  const anchor = Number.isFinite(endMs) ? String(endedAt) : startedAt;
  const t = Date.parse(anchor);
  const base = Number.isFinite(t) ? t : Date.now();
  return new Date(base + RETENTION_DISPLAY_DAYS * 86400000).toISOString();
}

function parseCharacterJoin(raw: unknown): { name: string; han: string } {
  if (raw && typeof raw === "object" && "name" in raw) {
    const o = raw as { name?: string; han?: string };
    return { name: String(o.name ?? ""), han: String(o.han ?? "") };
  }
  return { name: "", han: "" };
}

async function loadCharacterMap(
  supabase: ReturnType<typeof supabaseServer>,
  keys: string[],
): Promise<Record<string, { name: string; han: string }>> {
  if (!keys.length) return {};
  const { data: chars } = await supabase.from("characters").select("key, name, han").in("key", keys);
  return Object.fromEntries((chars ?? []).map((c) => [c.key, { name: c.name, han: c.han }]));
}

function countNonEmptyTurnsBySession(turns: { session_id?: string; text?: string | null }[] | null): Record<string, number> {
  const countBySession: Record<string, number> = {};
  for (const t of turns ?? []) {
    const sid = String(t.session_id ?? "");
    if (!sid || !String(t.text ?? "").trim()) continue;
    countBySession[sid] = (countBySession[sid] ?? 0) + 1;
  }
  return countBySession;
}

/** 음성 상담 전사(voice_turns)를 텍스트 대화 기록 UI와 동일 형태로 */
async function listRowsFromVoiceSessions(supabase: ReturnType<typeof supabaseServer>): Promise<TextChatListRow[]> {
  const since = historySinceIso();
  const { data: sessions, error } = await supabase
    .from("voice_sessions")
    .select("id, character_key, started_at, ended_at, duration_sec, status")
    .gte("started_at", since)
    .not("character_key", "is", null)
    .or("status.eq.ended,ended_at.not.is.null,duration_sec.gt.0")
    .order("started_at", { ascending: false })
    .limit(120);

  if (error) throw new Error(error.message);
  const list = sessions ?? [];
  if (list.length === 0) return [];

  const ids = list.map((s) => String((s as { id?: string }).id ?? "")).filter(Boolean);
  const keys = [...new Set(list.map((s) => String((s as { character_key?: string }).character_key ?? "").trim()).filter(Boolean))];
  const charMap = await loadCharacterMap(supabase, keys);

  const { data: midRows } = await supabase.from("voice_turns").select("session_id, text").in("session_id", ids);
  const countBySession = countNonEmptyTurnsBySession(midRows ?? []);

  const rows: TextChatListRow[] = [];
  for (const raw of list) {
    const r = raw as Record<string, unknown>;
    const id = String(r.id ?? "");
    if (!id) continue;
    const ck = String(r.character_key ?? "");
    const cm = charMap[ck];
    const endedAt = r.ended_at != null ? String(r.ended_at) : null;
    const started_at = String(r.started_at ?? "");
    const retention_until = retentionFromVoiceAnchor(endedAt, started_at);

    rows.push({
      id,
      character_key: ck,
      character_name: cm?.name || ck,
      started_at,
      retention_until,
      message_count: countBySession[id] ?? 0,
    });
  }
  return rows;
}

async function listRowsFromTextChatTables(supabase: ReturnType<typeof supabaseServer>): Promise<TextChatListRow[]> {
  const since = historySinceIso();
  const { data: sessions, error: sErr } = await supabase
    .from("text_chat_sessions")
    .select("id, character_key, started_at, retention_until")
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(120);

  if (sErr) throw new Error(sErr.message);
  const list = sessions ?? [];
  if (list.length === 0) return [];

  const ids = list.map((s) => String((s as { id?: string }).id ?? "")).filter(Boolean);
  const keys = [...new Set(list.map((s) => String((s as { character_key?: string }).character_key ?? "").trim()).filter(Boolean))];
  const charMap = await loadCharacterMap(supabase, keys);

  const { data: midRows } = await supabase.from("text_chat_messages").select("session_id").in("session_id", ids);
  const countBySession: Record<string, number> = {};
  for (const row of midRows ?? []) {
    const sid = String((row as { session_id?: string }).session_id ?? "");
    if (!sid) continue;
    countBySession[sid] = (countBySession[sid] ?? 0) + 1;
  }

  const rows: TextChatListRow[] = [];
  for (const raw of list) {
    const r = raw as Record<string, unknown>;
    const id = String(r.id ?? "");
    if (!id) continue;
    const ck = String(r.character_key ?? "");
    const cm = charMap[ck];
    rows.push({
      id,
      character_key: ck,
      character_name: cm?.name || ck,
      started_at: String(r.started_at ?? ""),
      retention_until: r.retention_until != null ? String(r.retention_until) : null,
      message_count: countBySession[id] ?? 0,
    });
  }
  return rows;
}

function mergeTextChatListRows(a: TextChatListRow[], b: TextChatListRow[]): TextChatListRow[] {
  const seen = new Set<string>();
  const out: TextChatListRow[] = [];
  for (const row of [...a, ...b].sort((x, y) => Date.parse(y.started_at) - Date.parse(x.started_at))) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= 100) break;
  }
  return out;
}

export const listTextChatSessions = cache(async (): Promise<TextChatListRow[]> => {
  const supabase = supabaseServer();
  const [fromVoice, fromText] = await Promise.all([
    listRowsFromVoiceSessions(supabase),
    listRowsFromTextChatTables(supabase).catch(() => [] as TextChatListRow[]),
  ]);
  return mergeTextChatListRows(fromVoice, fromText);
});

function mapVoiceTurnToMessage(m: Record<string, unknown>): TextChatMessageRow | null {
  const id = String(m.id ?? "");
  const body = String(m.text ?? "").trim();
  if (!id || !body) return null;
  const r = String(m.role ?? "").toLowerCase();
  const role: "user" | "assistant" = r === "user" ? "user" : "assistant";
  return {
    id,
    role,
    body: String(m.text ?? ""),
    created_at: String(m.created_at ?? ""),
  };
}

async function getTextChatDetailFromVoice(
  supabase: ReturnType<typeof supabaseServer>,
  sessionId: string,
): Promise<TextChatDetail | null> {
  const { data: sessionRaw, error: sErr } = await supabase
    .from("voice_sessions")
    .select("id, character_key, started_at, ended_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr || !sessionRaw) return null;

  const s = sessionRaw as Record<string, unknown>;
  const ck = String(s.character_key ?? "");
  const charMap = await loadCharacterMap(supabase, ck ? [ck] : []);
  const ch = charMap[ck] ?? { name: "", han: "" };

  const { data: msgRaw, error: mErr } = await supabase
    .from("voice_turns")
    .select("id, role, text, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (mErr) return null;

  const messages: TextChatMessageRow[] = [];
  for (const m of msgRaw ?? []) {
    const row = mapVoiceTurnToMessage(m as Record<string, unknown>);
    if (row) messages.push(row);
  }

  const started_at = String(s.started_at ?? "");
  const endedAt = s.ended_at != null ? String(s.ended_at) : null;
  const retention_until = retentionFromVoiceAnchor(endedAt, started_at || new Date().toISOString());

  return {
    id: String(s.id ?? sessionId),
    character_key: ck,
    character_name: ch.name || ck,
    character_han: ch.han || "緣",
    started_at,
    retention_until,
    messages,
  };
}

async function getTextChatDetailFromTextTables(
  supabase: ReturnType<typeof supabaseServer>,
  sessionId: string,
): Promise<TextChatDetail | null> {
  const { data: sessionRaw, error: sErr } = await supabase
    .from("text_chat_sessions")
    .select("id, character_key, started_at, retention_until")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr || !sessionRaw) return null;

  const s = sessionRaw as Record<string, unknown>;
  const ck = String(s.character_key ?? "");
  const charMap = await loadCharacterMap(supabase, ck ? [ck] : []);
  const ch = charMap[ck] ?? { name: "", han: "" };

  const { data: msgRaw, error: mErr } = await supabase
    .from("text_chat_messages")
    .select("id, role, body, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (mErr) return null;

  const messages: TextChatMessageRow[] = (msgRaw ?? []).map((m) => {
    const row = m as Record<string, unknown>;
    const role = row.role === "user" ? "user" : "assistant";
    return {
      id: String(row.id ?? ""),
      role,
      body: String(row.body ?? ""),
      created_at: String(row.created_at ?? ""),
    };
  });

  return {
    id: String(s.id ?? sessionId),
    character_key: ck,
    character_name: ch.name || ck,
    character_han: ch.han || "緣",
    started_at: String(s.started_at ?? ""),
    retention_until: s.retention_until != null ? String(s.retention_until) : null,
    messages,
  };
}

export const getTextChatSessionDetail = cache(async (sessionId: string): Promise<TextChatDetail | null> => {
  const supabase = supabaseServer();
  const fromVoice = await getTextChatDetailFromVoice(supabase, sessionId);
  if (fromVoice) return fromVoice;
  return getTextChatDetailFromTextTables(supabase, sessionId);
});

/** 음성 세션(`voice_sessions` + `voice_turns`)만 — 음성상담 보관함 상세용 */
export const getVoiceSessionConversationDetail = cache(async (sessionId: string): Promise<TextChatDetail | null> => {
  if (!isUuidSessionId(sessionId)) return null;
  return getTextChatDetailFromVoice(supabaseServer(), sessionId);
});
