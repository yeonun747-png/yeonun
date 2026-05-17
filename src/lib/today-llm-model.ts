import { CLAUDE_HAIKU_MODEL_DEFAULT, resolveClaudeHaikuModel } from "@/lib/claude-haiku-model";

/** 오늘 탭 일진·한마디 Anthropic 기본 모델 */
export const TODAY_LLM_MODEL_DEFAULT = CLAUDE_HAIKU_MODEL_DEFAULT;

export function resolveTodayLlmModel(primaryEnv?: string, secondaryEnv?: string): string {
  const primary = String(primaryEnv ?? "").trim();
  if (primary) return primary;
  const secondary = String(secondaryEnv ?? "").trim();
  if (secondary) return secondary;
  return resolveClaudeHaikuModel();
}
