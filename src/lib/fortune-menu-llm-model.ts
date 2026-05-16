/** `service_prompts.key` — Cloudways 메뉴 점사 스트림에 쓰는 모델 id */
export const FORTUNE_MENU_LLM_SERVICE_KEY = "yeonun_fortune_menu_llm" as const;

export const FORTUNE_MENU_LLM_OPTIONS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.x (기본)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
] as const;

export type FortuneMenuLlmModelId = (typeof FORTUNE_MENU_LLM_OPTIONS)[number]["id"];

const ALLOWED = new Set<string>(FORTUNE_MENU_LLM_OPTIONS.map((o) => o.id));

export function isAllowedFortuneMenuLlmModelId(id: string): boolean {
  return ALLOWED.has(String(id ?? "").trim());
}

export function normalizeFortuneMenuLlmModelId(raw: string | null | undefined, fallback: string): FortuneMenuLlmModelId {
  const t = String(raw ?? "").trim();
  if (isAllowedFortuneMenuLlmModelId(t)) return t as FortuneMenuLlmModelId;
  const f = String(fallback ?? "").trim();
  if (isAllowedFortuneMenuLlmModelId(f)) return f as FortuneMenuLlmModelId;
  return "claude-sonnet-4-6";
}
