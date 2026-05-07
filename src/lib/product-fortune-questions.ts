import { DEFAULT_FORTUNE_QUESTIONS, type FortuneQuestionItem } from "@/lib/fortune-ux/defaultQuestions";

function asQuestion(raw: unknown, idx: number): FortuneQuestionItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const prompt = String(o.prompt ?? "").trim();
  const choicesRaw = o.choices;
  if (!prompt) return null;
  const choices = Array.isArray(choicesRaw)
    ? choicesRaw.map((c) => String(c).trim()).filter(Boolean)
    : [];
  if (choices.length < 2) return null;
  const id = String(o.id ?? "").trim() || `fq_${idx + 1}`;
  return { id, prompt, choices };
}

/** 어드민 `products.fortune_questions` JSON → 질문 배열 */
export function parseProductFortuneQuestions(raw: unknown): readonly FortuneQuestionItem[] {
  if (raw == null) return DEFAULT_FORTUNE_QUESTIONS;
  if (!Array.isArray(raw)) return DEFAULT_FORTUNE_QUESTIONS;
  const out: FortuneQuestionItem[] = [];
  raw.forEach((item, i) => {
    const q = asQuestion(item, i);
    if (q) out.push(q);
  });
  return out.length >= 1 ? out : DEFAULT_FORTUNE_QUESTIONS;
}
