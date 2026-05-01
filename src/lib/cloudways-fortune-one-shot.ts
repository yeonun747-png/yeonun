import { normalizeCloudwaysBaseUrl } from "@/lib/cloudways-base-url";

function stripCodeFences(input: string): string {
  let html = String(input ?? "").trim();
  const htmlBlockMatch = html.match(/```html\s*([\s\S]*?)\s*```/i);
  if (htmlBlockMatch) return htmlBlockMatch[1].trim();
  const codeBlockMatch = html.match(/```\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  return html;
}

/** Cloudways `POST /chat` SSE를 끝까지 읽어 최종 HTML 문자열을 반환합니다. */
export async function fetchCloudwaysFortuneHtmlFromSse(opts: {
  cloudwaysUrl: string;
  cloudwaysSecret?: string;
  system: string;
  user: string;
  model: string;
  signal?: AbortSignal;
  /** 상위 스트림과 동일한 델타 단위로 전달(메뉴 점사 구간별 실시간 표시용) */
  onChunk?: (deltaText: string) => void;
}): Promise<{ html: string; streamError?: string }> {
  const base = normalizeCloudwaysBaseUrl(opts.cloudwaysUrl);
  const upstream = await fetch(`${base}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(opts.cloudwaysSecret ? { Authorization: `Bearer ${opts.cloudwaysSecret}` } : {}),
    },
    cache: "no-store",
    signal: opts.signal,
    body: JSON.stringify({
      system: opts.system,
      user: opts.user,
      model: opts.model,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const message = await upstream.text().catch(() => "");
    throw new Error(message.slice(0, 800) || `Cloudways HTTP ${upstream.status}`);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulatedText = "";
  let streamError: string | undefined;
  let lastDoneHtml = "";

  const handleBlock = (block: string) => {
    for (const line of block.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let evt: Record<string, unknown>;
      try {
        evt = JSON.parse(data) as Record<string, unknown>;
      } catch {
        continue;
      }
      const typ = evt.type;
      if (typ === "content_block_delta" && (evt.delta as { type?: string; text?: string } | undefined)?.type === "text_delta") {
        const dt = (evt.delta as { text?: string }).text;
        if (typeof dt === "string" && dt.length > 0) {
          accumulatedText += dt;
          opts.onChunk?.(dt);
        }
      }
      if (typ === "chunk" && typeof evt.text === "string" && evt.text.length > 0) {
        accumulatedText += evt.text;
        opts.onChunk?.(evt.text);
      }
      if (typ === "partial_done" && typeof evt.html === "string") {
        lastDoneHtml = evt.html;
      }
      if (typ === "done") {
        if (typeof evt.html === "string") lastDoneHtml = evt.html;
      }
      if (typ === "error") {
        streamError = String((evt.error as { message?: string } | undefined)?.message ?? evt.message ?? "stream error");
      }
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const block of parts) handleBlock(block);
    }
    if (buffer.trim()) handleBlock(buffer);
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    streamError = e instanceof Error ? e.message : String(e);
  }

  const raw = lastDoneHtml || accumulatedText;
  const html = stripCodeFences(raw).replace(/\*\*/g, "");
  return { html, streamError };
}
