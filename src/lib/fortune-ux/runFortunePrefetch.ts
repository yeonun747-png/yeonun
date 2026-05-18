"use client";

import type { FortunePrefetchV1 } from "@/lib/fortune-prefetch-storage";
import { readFortunePrefetch, writeFortunePrefetch } from "@/lib/fortune-prefetch-storage";
import { createFortunePrefetchPump } from "@/lib/fortune-prefetch-sse-engine";
import { buildFortunePrefetchStreamBody } from "@/lib/fortune-prefetch-stream-body";
import type { DemoProfile } from "@/lib/fortune-two-stage-demo";
import { fetchFortuneMenuStream } from "@/lib/fortune-ux/fetchFortuneMenuStream";

export type RunFortunePrefetchArgs = {
  productSlug: string;
  title: string;
  characterKey: string;
  profile: DemoProfile;
  orderNo?: string | null;
  signal: AbortSignal;
  /** 스토리지 기록 직후 동일 스냅샷을 UI에 전달 */
  onPatch?: (payload: FortunePrefetchV1) => void;
};

/** 생년 제출 직후 백그라운드 Claude 스트림 — STEP6 미리보기/결제 후 캐시용(품질·출력 상한은 일반 스트림과 동일) */
export async function runFortunePrefetch(args: RunFortunePrefetchArgs): Promise<void> {
  const { productSlug, profile, orderNo, signal, onPatch } = args;

  const streamBody = buildFortunePrefetchStreamBody(args);
  const streamHeaders = { "Content-Type": "application/json", Accept: "text/event-stream" as const };

  const pump = createFortunePrefetchPump({
    profile,
    initial: readFortunePrefetch(productSlug),
    onSnapshot: (payload) => {
      writeFortunePrefetch(productSlug, payload);
      onPatch?.(payload);
    },
  });

  if (pump.isAlreadyComplete) return;

  let res = await fetchFortuneMenuStream(streamBody, signal);

  const menuStreamOk =
    res.ok && res.body && (res.headers.get("content-type") ?? "").toLowerCase().includes("text/event-stream");

  if (menuStreamOk && res.body) {
    await pump.pumpSseBody(res.body.getReader(), "sections");
    pump.finalizeMenuSectionsStream(signal.aborted);
    return;
  }

  res = await fetch("/api/fortune/chat-stream", {
    method: "POST",
    headers: streamHeaders,
    body: JSON.stringify(streamBody),
    signal,
  });

  if (res.status === 501) {
    res = await fetch("/api/fortune/two-stage-demo", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        product_slug: productSlug,
        profile,
        manse_context: streamBody.manse_ryeok_text,
        character_key: streamBody.character_key,
        order_no: orderNo ?? undefined,
      }),
      signal,
    });
    if (!res.ok || !res.body) return;
    await pump.pumpSseBody(res.body.getReader(), "sections");
    return;
  }

  if (!res.ok || !res.body) return;
  await pump.pumpSseBody(res.body.getReader(), "claude_html_stream");
  pump.finalizeClaudeHtmlStream(signal.aborted);
}
