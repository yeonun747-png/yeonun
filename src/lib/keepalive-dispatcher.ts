/**
 * Cloudways 등 동일 오리진 반복 호출용 keep-alive dispatcher.
 * Node의 기본 fetch(undici)도 연결을 풀링하지만 기본 keepAliveTimeout(4초)이 짧아
 * 점사 호출 간격에 소켓이 닫혀 매번 TLS 핸드셰이크가 든다. timeout을 늘려 소켓을 더 오래 재사용한다.
 *
 * 절대원칙(점사 막힘 금지): undici 로드 실패 시 undefined를 반환해 호출부가 기본 fetch로 동작한다.
 */
let resolved = false;
let cached: unknown;

export async function getKeepAliveDispatcher(): Promise<unknown> {
  if (resolved) return cached;
  resolved = true;
  try {
    const undici = (await import("undici")) as {
      Agent: new (opts: Record<string, unknown>) => unknown;
    };
    cached = new undici.Agent({
      keepAliveTimeout: 30_000,
      keepAliveMaxTimeout: 60_000,
      connections: 64,
    });
  } catch {
    cached = undefined;
  }
  return cached;
}
