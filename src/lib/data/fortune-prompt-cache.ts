import {
  getCharacterModePrompt,
  getServicePrompt,
  type CharacterModePrompt,
  type CharacterModePromptMode,
  type ServicePrompt,
} from "@/lib/data/characters";
import { getProductBySlug, type Product } from "@/lib/data/content";
import { createTtlCache } from "@/lib/ttl-cache";

/**
 * 점사 시작 임계경로 전용 cross-request 캐시.
 * 상품·프롬프트는 어드민이 가끔만 수정하므로 TTL 동안 DB 왕복을 생략해 TTFT를 줄인다.
 * stale-on-error라 DB 일시 장애에도 직전 값으로 점사를 시작할 수 있다(절대 막힘 없음).
 *
 * 반영 지연은 TTL(기본 60초) 범위. 즉시 반영이 필요하면 invalidate*()를 호출한다.
 */
const TTL_MS = Number(process.env.FORTUNE_PROMPT_CACHE_TTL_MS ?? 60_000) || 60_000;

const productCache = createTtlCache<Product | null>({ ttlMs: TTL_MS });
const servicePromptCache = createTtlCache<ServicePrompt | null>({ ttlMs: TTL_MS });
const characterPromptCache = createTtlCache<CharacterModePrompt | null>({ ttlMs: TTL_MS });

export function getProductBySlugTtl(slug: string): Promise<Product | null> {
  return productCache.get(slug, () => getProductBySlug(slug));
}

export function getServicePromptTtl(key: string): Promise<ServicePrompt | null> {
  return servicePromptCache.get(key, () => getServicePrompt(key));
}

export function getCharacterModePromptTtl(
  characterKey: string,
  mode: CharacterModePromptMode,
): Promise<CharacterModePrompt | null> {
  return characterPromptCache.get(`${characterKey}::${mode}`, () =>
    getCharacterModePrompt(characterKey, mode),
  );
}

export function invalidateFortunePromptCache(): void {
  productCache.invalidate();
  servicePromptCache.invalidate();
  characterPromptCache.invalidate();
}
