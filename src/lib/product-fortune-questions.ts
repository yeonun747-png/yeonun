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

/** 어드민 편집용: DB/미설정 값을 기본 포함한 질문 배열로 복사본 반환 */
export function cloneFortuneQuestionsForEditor(raw: unknown): FortuneQuestionItem[] {
  const parsed = parseProductFortuneQuestions(raw);
  return parsed.map((q) => ({ id: q.id, prompt: q.prompt, choices: [...q.choices] }));
}

/**
 * 상품 저장용 JSON 검증. 유효한 질문이 하나도 없으면 null(기본 질문 세트로 표시).
 * @throws 파싱 실패 시
 */
export function parseFortuneQuestionsJsonFromForm(raw: string): FortuneQuestionItem[] | null {
  const t = raw.trim();
  if (!t.length) return null;
  let data: unknown;
  try {
    data = JSON.parse(t) as unknown;
  } catch {
    throw new Error("fortune_questions_json 파싱 실패");
  }
  if (!Array.isArray(data)) throw new Error("fortune_questions_json은 배열이어야 합니다");
  const out: FortuneQuestionItem[] = [];
  data.forEach((item, i) => {
    const q = asQuestion(item, i);
    if (q) out.push(q);
  });
  return out.length >= 1 ? out : null;
}
