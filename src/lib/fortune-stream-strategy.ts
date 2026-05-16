import type { FortuneMenuPayload } from "@/lib/product-fortune-menu";

/** DB `products.fortune_stream_strategy` — 메뉴 점사 스트림 전략 */
export type FortuneStreamStrategy = "claude_only" | "hybrid";

export function normalizeFortuneStreamStrategy(raw: unknown): FortuneStreamStrategy {
  return String(raw ?? "").trim() === "hybrid" ? "hybrid" : "claude_only";
}

/** HYBRID: 첫 대메뉴에 속한 소메뉴(스트림 섹션) 개수 — `flattenFortuneMenuForStream` 앞부분과 동일 순서 */
export function hybridClaudeSectionCount(menu: FortuneMenuPayload): number {
  const first = menu.main_menus[0];
  if (!first) return 0;
  return (first.sub_menus ?? []).filter((s) => String(s.title ?? "").trim().length > 0).length;
}
