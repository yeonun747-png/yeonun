/**
 * 프로세스 메모리 TTL 캐시.
 * 연운 절대원칙(점사는 막히면 안 됨)에 맞춰 stale-on-error로 동작한다:
 * 로더가 throw하면 만료된 값이라도 직전 성공값을 반환해 점사 시작을 막지 않는다.
 *
 * - 성공값은 ttlMs 동안 캐시.
 * - null/undefined(부재·일시 오류 가능성) 은 negativeTtlMs(짧게) 동안만 캐시해 회복 지연을 줄인다.
 */
type Entry<T> = { value: T; expiresAt: number };

export type TtlCache<T> = {
  get(key: string, loader: () => Promise<T>): Promise<T>;
  invalidate(key?: string): void;
};

export function createTtlCache<T>(opts: {
  ttlMs: number;
  negativeTtlMs?: number;
}): TtlCache<T> {
  const ttlMs = Math.max(0, opts.ttlMs);
  const negativeTtlMs = Math.max(0, opts.negativeTtlMs ?? Math.min(ttlMs, 5_000));
  const store = new Map<string, Entry<T>>();

  return {
    async get(key: string, loader: () => Promise<T>): Promise<T> {
      const now = Date.now();
      const hit = store.get(key);
      if (hit && now < hit.expiresAt) return hit.value;

      try {
        const value = await loader();
        const isEmpty = value == null;
        store.set(key, {
          value,
          expiresAt: now + (isEmpty ? negativeTtlMs : ttlMs),
        });
        return value;
      } catch (e) {
        // 로더 실패 — 직전 성공값이 있으면 만료됐어도 그대로 반환(fail-open).
        if (hit) return hit.value;
        throw e;
      }
    },
    invalidate(key?: string): void {
      if (key == null) store.clear();
      else store.delete(key);
    },
  };
}
