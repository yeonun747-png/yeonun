import { rollMaxTranscriptChars } from "@/lib/voice-roll-triggers";

export type HaikuMemoryItem = {
  type: string;
  importance: number;
  summary: string;
};

export type VoiceRollupHaikuResult = {
  continuity_narrative: string;
  compressed_bullets: string[];
  memories: HaikuMemoryItem[];
};

function defaultHaikuModel(): string {
  return String(process.env.CLAUDE_HAIKU_MODEL ?? "claude-3-5-haiku-20241022").trim() || "claude-3-5-haiku-20241022";
}

function extractJsonObject(raw: string): unknown {
  const t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : t;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no_json_object");
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * 대화 일부만 입력(전체 transcript 금지 상한). JSON만 출력하도록 강제.
 * importance < 0.7 항목은 배열에 넣지 말 것 — 후단에서도 필터.
 */
export async function runVoiceRollupHaiku(opts: {
  apiKey: string;
  dialogExcerpt: string;
  priorContinuity?: string;
}): Promise<VoiceRollupHaikuResult> {
  const model = defaultHaikuModel();
  const cap = rollMaxTranscriptChars();
  const excerpt = String(opts.dialogExcerpt ?? "").trim().slice(0, cap);
  if (excerpt.length < 80) {
    throw new Error("dialog_too_short");
  }

  const system = [
    "당신은 연운 음성 상담용 **메모리 압축기**입니다. 출력은 **JSON 한 덩어리만** (앞뒤 설명·마크다운 금지).",
    "",
    "JSON 스키마:",
    "{",
    '  "continuity_narrative": string,',
    '  "compressed_bullets": string[],',
    '  "memories": [ { "type": string, "importance": number, "summary": string } ]',
    "}",
    "",
    "규칙:",
    "- continuity_narrative: 한국어 2~4문장. 상담사가 **끊김 없이** 이어 말하듯 자연스럽게. 사실 나열·기계적 요약 금지.",
    "- compressed_bullets: 한 줄당 한 가지 핵심만, 최대 8개. 인사·잡담·중복 인사 제외.",
    "- memories.type: emotional_context | long_term_concern | user_preference 중 하나.",
    "- importance: 0~1 소수. **0.7 미만은 배열에 넣지 마라** (절대 저장되면 안 됨).",
    "- 0.9 이상은 매우 중요한 장기 맥락만.",
    "- meaningless smalltalk, filler, 반복 인사, 바지인으로 끊긴 불완전 문장, 낮은 신뢰 추정 내용은 memories·bullets 모두에서 제외.",
    "- 저장 대상 예: 외로움·불안·번아웃·연애·가족·직업·재물·결혼·시험·건강·사업 등 **지속 상담 가치**가 있는 것만.",
    "- 사용자 성향(현실적 조언 선호 등)은 user_preference로.",
    "",
    "입력에 이전 연속 문맥이 있으면 narrative에서 자연스럽게만 반영하고, 전사를 복붙하지 마라.",
  ].join("\n");

  const prior = String(opts.priorContinuity ?? "").trim().slice(0, 1200);
  const userBlock = prior
    ? `[이전 연속 힌트]\n${prior}\n\n[압축 대상 대화 발췌]\n${excerpt}`
    : `[압축 대상 대화 발췌]\n${excerpt}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": opts.apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: 2500,
      temperature: 0.15,
      system,
      messages: [{ role: "user", content: userBlock }],
    }),
  });

  const raw = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`haiku_http_${res.status}:${raw.slice(0, 400)}`);

  const j = JSON.parse(raw || "{}") as { content?: Array<{ type?: string; text?: string }> };
  const parts = Array.isArray(j.content) ? j.content : [];
  const text = parts.map((p) => (p.type === "text" ? String(p.text || "") : "")).join("").trim();
  const parsed = extractJsonObject(text) as Record<string, unknown>;

  const continuity_narrative = String(parsed.continuity_narrative ?? "").trim().slice(0, 2000);
  const bulletsRaw = parsed.compressed_bullets;
  const compressed_bullets = Array.isArray(bulletsRaw)
    ? bulletsRaw.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 8)
    : [];

  const memRaw = parsed.memories;
  const memories: HaikuMemoryItem[] = [];
  if (Array.isArray(memRaw)) {
    for (const m of memRaw) {
      if (!m || typeof m !== "object") continue;
      const o = m as Record<string, unknown>;
      const type = String(o.type ?? "").trim();
      const summary = String(o.summary ?? "").trim().slice(0, 600);
      const importance = Number(o.importance);
      if (!type || !summary || !Number.isFinite(importance)) continue;
      if (importance < 0.7) continue;
      memories.push({
        type: type.slice(0, 64),
        importance: Math.min(1, Math.max(0.7, importance)),
        summary,
      });
    }
  }

  if (!continuity_narrative && memories.length === 0 && compressed_bullets.length === 0) {
    throw new Error("empty_haiku_result");
  }

  return {
    continuity_narrative: continuity_narrative || compressed_bullets.slice(0, 2).join(" "),
    compressed_bullets,
    memories,
  };
}
