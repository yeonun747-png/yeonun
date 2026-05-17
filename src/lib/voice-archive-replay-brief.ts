import type { TextChatMessageRow } from "@/lib/text-chat-history-public";

/** 보관함 「이 주제로 다시 상담」→ /call-dcc 세션 summary용 */
export function buildVoiceArchiveReplayBrief(messages: TextChatMessageRow[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    const body = m.body.trim();
    if (!body) continue;
    const who = m.role === "user" ? "사용자" : "상담사";
    lines.push(`${who}: ${body.replace(/\s+/g, " ").slice(0, 400)}`);
  }
  return lines.slice(-30).join("\n").slice(0, 3200);
}
