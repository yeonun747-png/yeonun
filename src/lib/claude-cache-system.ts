/**
 * Anthropic prompt caching — 공용 system 패딩·cache_control 블록.
 * @see https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 *
 * Sonnet 4.6: 캐시 가능한 블록 최소 2048 토큰(미만이면 캐시 미적용·에러 없음).
 */

/** 문서 기준(기본 Sonnet 4.6 = 2048). `FORTUNE_CLAUDE_CACHE_MIN_TOKENS`로 덮어쓸 수 있음. */
export function anthropicCacheMinTokens(): number {
  const raw = Number(process.env.FORTUNE_CLAUDE_CACHE_MIN_TOKENS ?? "");
  if (Number.isFinite(raw) && raw >= 256) return Math.floor(raw);
  return 2048;
}

/** 한글 위주 러프 추정(보수적: 짧게 잡아 패딩이 넉넉히 들어가게) */
export function approxInputTokensKoreanHeavy(text: string): number {
  return Math.max(1, Math.ceil(String(text ?? "").length / 3));
}

/**
 * 캐시 블록 텍스트가 모델 최소 토큰 미만이면, 무해한 패딩으로 길이만 맞춤.
 */
export function padCacheableSystemTextToMinTokens(text: string, minTokens?: number): string {
  const min = minTokens ?? anthropicCacheMinTokens();
  if (approxInputTokensKoreanHeavy(text) >= min) return text;
  const targetChars = min * 3;
  const padHeader =
    "\n\n[연운 시스템 프롬프트 캐시 길이 패딩 — Anthropic 최소 토큰 충족용. 응답·본문에 출력하지 마세요.]\n";
  const need = Math.max(0, targetChars - text.length - padHeader.length);
  const filler = "·".repeat(need);
  return `${text}${padHeader}${filler}`;
}

export type CachedSystemBlock = {
  type: "text";
  text: string;
  cache_control: { type: "ephemeral"; ttl: "1h" };
};

export function cachedSystemBlocks(paddedCacheableText: string): CachedSystemBlock[] {
  return [
    {
      type: "text",
      text: paddedCacheableText,
      cache_control: { type: "ephemeral", ttl: "1h" },
    },
  ];
}
