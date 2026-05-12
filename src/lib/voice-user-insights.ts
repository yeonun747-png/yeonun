import type { SupabaseClient } from "@supabase/supabase-js";

export type VoiceUserInsightRow = {
  id: string;
  user_ref: string;
  character_key: string;
  session_id: string | null;
  category: string;
  detail: string;
  importance_level: number;
  created_at: string;
};

const MAX_INSIGHTS = 8;
const MAX_CONTEXT_CHARS = 1500;

/** 최근 후보를 가져온 뒤 중요도·시간으로 정렬 — 프롬프트 비용 절감용 상한 적용 */
export async function fetchVoiceUserInsightsForContext(
  supabase: SupabaseClient,
  userRef: string,
  characterKey: string,
): Promise<VoiceUserInsightRow[]> {
  const ref = String(userRef ?? "").trim();
  const ck = String(characterKey ?? "").trim();
  if (!ref || ref === "guest" || !ck) return [];

  const { data, error } = await supabase
    .from("voice_user_insights")
    .select("id,user_ref,character_key,session_id,category,detail,importance_level,created_at")
    .eq("user_ref", ref)
    .eq("character_key", ck)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !Array.isArray(data)) return [];
  const rows = [...(data as VoiceUserInsightRow[])].sort((a, b) => {
    const di = (b.importance_level ?? 0) - (a.importance_level ?? 0);
    if (di !== 0) return di;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const picked: VoiceUserInsightRow[] = [];
  let chars = 0;
  for (const r of rows) {
    const line = formatInsightLine(r);
    if (picked.length >= MAX_INSIGHTS) break;
    if (chars + line.length > MAX_CONTEXT_CHARS) break;
    picked.push(r);
    chars += line.length;
  }
  return picked;
}

function formatInsightLine(r: VoiceUserInsightRow): string {
  const d = String(r.detail ?? "").replace(/\s+/g, " ").trim();
  return `- [${r.category}|중요도${r.importance_level}] ${d.slice(0, 280)}\n`;
}

/** 시스템 프롬프트 [User_History_Context] 블록 — 짧게 유지(Pruning은 길이·개수로 선제 적용) */
export function buildUserHistoryContextBlock(insights: VoiceUserInsightRow[]): string {
  if (!insights.length) return "";
  const lines = insights.map((r) => formatInsightLine(r).trimEnd()).join("\n");
  return (
    `[User_History_Context]\n` +
    `아래는 이 사용자가 과거 음성 상담에서 남긴 핵심 메모입니다. 사실로만 취급하고, 없는 내용은 상상하지 마세요.\n` +
    `이 블록은 입장 직후 인사·첫 질문에만 참고하고, 이후 턴에서는 반복 인용하지 말고 최근 대화(음성)를 우선하세요.\n` +
    `${lines}`
  );
}
