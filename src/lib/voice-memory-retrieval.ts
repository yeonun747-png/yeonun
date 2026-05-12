import type { SupabaseClient } from "@supabase/supabase-js";

export type VoiceMemoryEntryRow = {
  id: string;
  user_ref: string;
  character_key: string;
  session_id: string | null;
  memory_type: string;
  importance: number;
  summary: string;
  promoted: boolean;
  created_at: string;
};

const MAX_ENTRIES = 12;
const MAX_CONTEXT_CHARS = 1400;

/** importance >= 0.7 만 DB에 있다고 가정. 최근·고점수 우선 */
export async function fetchVoiceMemoryEntriesForContext(
  supabase: SupabaseClient,
  userRef: string,
  characterKey: string,
): Promise<VoiceMemoryEntryRow[]> {
  const ref = String(userRef ?? "").trim();
  const ck = String(characterKey ?? "").trim();
  /** 공유 풀 방지: 리터럴 guest(구 클라이언트)는 제외. 신규는 세션 API에서 visitor_* 부여 */
  if (!ref || ref === "guest" || !ck) return [];

  const { data, error } = await supabase
    .from("voice_memory_entries")
    .select("id,user_ref,character_key,session_id,memory_type,importance,summary,promoted,created_at")
    .eq("user_ref", ref)
    .eq("character_key", ck)
    .gte("importance", 0.7)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(40);

  if (error || !Array.isArray(data)) return [];

  const rows = [...(data as VoiceMemoryEntryRow[])].sort((a, b) => {
    const pr = Number(b.promoted) - Number(a.promoted);
    if (pr !== 0) return pr;
    const di = (b.importance ?? 0) - (a.importance ?? 0);
    if (di !== 0) return di;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const picked: VoiceMemoryEntryRow[] = [];
  let chars = 0;
  for (const r of rows) {
    const line = formatMemoryLine(r);
    if (picked.length >= MAX_ENTRIES) break;
    if (chars + line.length > MAX_CONTEXT_CHARS) break;
    picked.push(r);
    chars += line.length;
  }
  return picked;
}

function formatMemoryLine(r: VoiceMemoryEntryRow): string {
  const s = String(r.summary ?? "").replace(/\s+/g, " ").trim();
  const tag = r.promoted ? "장기" : "핵심";
  return `- [${tag}|${r.memory_type}|${Number(r.importance).toFixed(2)}] ${s.slice(0, 320)}\n`;
}

export function buildVoiceMemoryEntriesContextBlock(entries: VoiceMemoryEntryRow[]): string {
  if (!entries.length) return "";
  const lines = entries.map((r) => formatMemoryLine(r).trimEnd()).join("\n");
  return (
    `[Compressed_Memory]\n` +
    `아래는 **압축된 핵심 메모**입니다. 전체 대화가 아닙니다. 사실만 취급하고, 나열하듯 읽지 말고 대화 속에서만 자연스럽게 반영하세요.\n` +
    `${lines}`
  );
}
