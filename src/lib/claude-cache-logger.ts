export type ClaudeCacheService = "chat" | "fortune-legacy";

export type AnthropicUsageLike = {
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
};

export function isClaudeCacheLogEnabled(): boolean {
  return String(process.env.CLAUDE_CACHE_LOG ?? "").trim() === "1";
}

/** SSE `message_stop` 등 usage 객체 (캐시 로그 비활성) */
export function logClaudeCacheUsage(_service: ClaudeCacheService, _usage: AnthropicUsageLike | null | undefined): void {
  if (!isClaudeCacheLogEnabled()) return;
}

export function extractUsageFromAnthropicStreamEvent(evt: unknown): AnthropicUsageLike | null {
  if (!evt || typeof evt !== "object") return null;
  const o = evt as Record<string, unknown>;
  const direct = o.usage;
  if (direct && typeof direct === "object") return direct as AnthropicUsageLike;
  const msg = o.message;
  if (msg && typeof msg === "object" && "usage" in msg) {
    const u = (msg as { usage?: unknown }).usage;
    if (u && typeof u === "object") return u as AnthropicUsageLike;
  }
  return null;
}

/**
 * Anthropic Messages SSE를 그대로 중계하면서 `message_stop` usage에 대해 캐시 로그 1회.
 */
export function wrapAnthropicSseStreamWithCacheLogging(
  body: ReadableStream<Uint8Array>,
  service: ClaudeCacheService,
): ReadableStream<Uint8Array> {
  if (!isClaudeCacheLogEnabled()) return body;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let logged = false;

  const scanBuffer = () => {
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data || data === "[DONE]") continue;
      let evt: unknown;
      try {
        evt = JSON.parse(data);
      } catch {
        continue;
      }
      const type = (evt as { type?: string })?.type;
      const usage = extractUsageFromAnthropicStreamEvent(evt);
      if (type === "message_stop" && usage && !logged) {
        logged = true;
        logClaudeCacheUsage(service, usage);
      }
    }
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value?.length) {
            controller.enqueue(value);
            buffer += decoder.decode(value, { stream: true });
            scanBuffer();
          }
        }
        if (buffer.trim()) {
          buffer += "\n";
          scanBuffer();
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
}
