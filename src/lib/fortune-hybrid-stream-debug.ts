/**
 * 하이브리드 점사 스트림 디버그 훅 (호출부 유지, 콘솔 출력 없음).
 */
import type { FortuneStreamEvt } from "@/lib/fortune-stream-client";

export function isFortuneHybridStreamDebug(): boolean {
  return false;
}

export function resetFortuneHybridStreamDebug(_streamPath: string): void {}

export function logFortuneStreamSessionUpstream(
  _upstream: Record<string, unknown> | undefined,
  _extras?: { streamPath?: string },
): void {}

export function inspectFortuneSseRaw(_raw: unknown): void {}

export function logFortuneStreamEvent(_ev: FortuneStreamEvt): void {}

export function logFortuneStreamPathChosen(_path: string): void {}

export function logFortuneStreamFallback(_path: "chat-stream" | "chat-stream-menus" | "two-stage-demo"): void {}

export function logClaudeHtmlStreamMode(_source: string): void {}
