/** OpenAI Realtime `response.done` 페이로드에서 usage 추출 (스키마 변형 허용) */
export function extractRealtimeResponseUsage(msg: Record<string, unknown>): {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
} | null {
  const response = msg.response;
  if (!response || typeof response !== "object") return null;
  const usage = (response as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, unknown>;
  const input = Math.max(
    0,
    Math.floor(
      Number(u.input_tokens ?? u.input_token_count ?? (u as { input?: number }).input ?? 0) || 0,
    ),
  );
  const output = Math.max(
    0,
    Math.floor(
      Number(u.output_tokens ?? u.output_token_count ?? (u as { output?: number }).output ?? 0) || 0,
    ),
  );
  let total = Math.max(0, Math.floor(Number(u.total_tokens ?? u.total_token_count ?? 0) || 0));
  if (total === 0 && (input > 0 || output > 0)) total = input + output;
  if (input === 0 && output === 0 && total === 0) return null;
  return { input_tokens: input, output_tokens: output, total_tokens: total };
}
