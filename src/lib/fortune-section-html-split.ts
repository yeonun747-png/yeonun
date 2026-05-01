/**
 * 점사 HTML에서 첫 `h3.subtitle-title` 닫는 태그 직후로 나눔 — 소제목(h3) 아래·본문 앞에 썸네일 삽입
 */
export function splitHtmlAfterFirstSubtitleH3Close(html: string): { head: string; tail: string } | null {
  const t = String(html ?? "");
  if (!t.trim()) return null;
  const lower = t.toLowerCase();
  const close = "</h3>";
  const closeIdx = lower.indexOf(close);
  if (closeIdx === -1) return null;
  const before = t.slice(0, closeIdx + close.length);
  if (!/subtitle-title/i.test(before)) return null;
  const tail = t.slice(closeIdx + close.length).trim();
  return { head: before, tail };
}
