/** 브라우저 스트림 실패 시 집계 (fire-and-forget) */
export function reportChatLlmErrorClient(): void {
  if (typeof window === "undefined") return;
  void fetch("/api/chat/llm-error", { method: "POST" }).catch(() => {});
}
