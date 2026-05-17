/** Anthropic Haiku — 앱 공통 기본(오늘 탭·점사→음성 요약·대화 압축·음성 메모리 롤업) */
export const CLAUDE_HAIKU_MODEL_DEFAULT = "claude-haiku-4-5-20251001";

/** 기본 모델 비활성/권한 오류 시 폴백(점사→음성 요약 등) */
export const CLAUDE_HAIKU_MODEL_FALLBACK = "claude-3-5-haiku-20241022";

export function resolveClaudeHaikuModel(override?: string): string {
  const v = String(override ?? process.env.CLAUDE_HAIKU_MODEL ?? "").trim();
  if (v) return v;
  return CLAUDE_HAIKU_MODEL_DEFAULT;
}
