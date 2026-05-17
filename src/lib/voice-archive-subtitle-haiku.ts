import {
  CLAUDE_HAIKU_MODEL_FALLBACK,
  resolveClaudeHaikuModel,
} from "@/lib/claude-haiku-model";

/** 보관함 부제목 — 한글 글자 수 상한(공백 포함) */
export const VOICE_ARCHIVE_SUBTITLE_MAX_CHARS = 50;

function extractAssistantText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const content = (data as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const b = block as { type?: string; text?: string };
      return b.type === "text" ? String(b.text ?? "") : "";
    })
    .join("")
    .trim();
}

function normalizeOneLine(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^["'「『]|["'」』]$/g, "")
    .trim()
    .slice(0, VOICE_ARCHIVE_SUBTITLE_MAX_CHARS);
}

/** 보관함 목록 부제목 — 대화 전사를 한 문장으로 */
export async function summarizeVoiceArchiveSubtitleHaiku(
  dialogExcerpt: string,
  apiKey: string,
): Promise<string> {
  const excerpt = String(dialogExcerpt ?? "").trim().slice(0, 12_000);
  if (excerpt.length < 12) return "";

  const system = [
    "연운(緣運) 음성 상담 대화를 **한 문장**으로만 요약합니다.",
    "출력 규칙:",
    "- 한국어 한 문장만 (마침표 하나로 끝).",
    `- 반드시 ${VOICE_ARCHIVE_SUBTITLE_MAX_CHARS}글자 이내(공백 포함). 초과 금지.`,
    "- 사용자가 다룬 **주제·고민·상황** 중심 (인사·잡담만이면 「짧은 인사 후 종료」).",
    "- 상담사 해석·조언·미래 예측은 넣지 말고 사실·주제만.",
    "- 따옴표·번호·이모지·접두 설명 금지.",
  ].join("\n");

  const models = [resolveClaudeHaikuModel(), CLAUDE_HAIKU_MODEL_FALLBACK].filter(
    (m, i, arr) => arr.indexOf(m) === i,
  );

  for (const model of models) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model,
        max_tokens: 80,
        temperature: 0.2,
        system,
        messages: [{ role: "user", content: `[대화 전사]\n${excerpt}` }],
      }),
    });
    const raw = await res.text().catch(() => "");
    if (!res.ok) continue;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    const line = normalizeOneLine(extractAssistantText(data));
    if (line) return line;
  }

  return "";
}

export function fallbackVoiceArchiveSubtitle(dialogExcerpt: string): string {
  const lines = String(dialogExcerpt ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const userLine = lines.find((l) => l.startsWith("사용자:"));
  if (userLine) {
    const body = userLine.replace(/^사용자:\s*/, "").trim();
    if (body.length >= 4) return normalizeOneLine(body);
  }
  if (lines.length > 0) return "음성 상담 기록";
  return "";
}

export function buildVoiceTurnsDialogExcerpt(
  turns: { role: string; text: string }[],
): string {
  const lines: string[] = [];
  for (const t of turns) {
    const text = String(t.text ?? "").trim();
    if (!text) continue;
    const who = t.role === "user" ? "사용자" : "상담사";
    lines.push(`${who}: ${text.replace(/\s+/g, " ").slice(0, 500)}`);
  }
  return lines.slice(-40).join("\n").slice(0, 12_000);
}
