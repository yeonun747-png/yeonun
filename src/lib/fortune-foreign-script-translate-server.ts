/** 서버 전용: 점사 본문에 섞인 외국 문자열을 한국어로 번역 (Gemini) */

import { foreignScriptNeedsTranslation } from "@/lib/fortune-foreign-script-detect";

export { foreignScriptNeedsTranslation };

function geminiApiKey(): string {
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim();
}

function foreignFixModel(): string {
  return String(process.env.FORTUNE_FOREIGN_FIX_MODEL ?? "gemini-2.0-flash").trim() || "gemini-2.0-flash";
}

function parseTranslationJson(raw: string, inputs: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const trimmed = String(raw ?? "").trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fence ? fence[1].trim() : trimmed;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return out;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return out;
  const o = parsed as Record<string, unknown>;
  for (const key of inputs) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  return out;
}

/** 고유 외국어 조각 → 한국어 (API 키 없으면 빈 객체) */
export async function translateForeignTextsToKoreanServer(texts: string[]): Promise<Record<string, string>> {
  const inputs = [...new Set(texts.map((t) => String(t ?? "").trim()).filter(Boolean))].filter((t) =>
    foreignScriptNeedsTranslation(t),
  );
  if (inputs.length === 0) return {};

  const apiKey = geminiApiKey();
  if (!apiKey) return {};

  const model = foreignFixModel();
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const prompt = [
    "다음 문자열 배열의 각 항목을 점사·운세 본문에 어울리는 자연스러운 한국어 한 단어 또는 짧은 구로 번역하세요.",
    "키는 입력과 정확히 같게, 값만 한국어로. 설명·마크다운 없이 JSON 객체만 출력하세요.",
    "예: [\"колодец\"] → {\"колодец\":\"우물\"}",
    "",
    JSON.stringify(inputs),
  ].join("\n");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) return {};

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return parseTranslationJson(text, inputs);
}
