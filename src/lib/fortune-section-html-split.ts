function fortuneHtmlFragmentPlainText(htmlFrag: string): string {
  return String(htmlFrag ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** 대메뉴·h3 비교용(유니코드·공백·제로폭 문자 정리) */
export function normFortunePlainTextForCompare(s: string): string {
  let t = fortuneHtmlFragmentPlainText(s)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  try {
    t = t.normalize("NFKC");
  } catch {
    /* ignore */
  }
  return t;
}

function fortunePlainCompact(s: string): string {
  return normFortunePlainTextForCompare(s).replace(/\s/g, "");
}

/**
 * 첫 `subtitle-section` 블록 안의 첫 `<h3>…</h3>` 표시 텍스트(클래스 무관).
 * 모델이 `subtitle-title` 클래스를 빼먹으면 기존 strict 비교가 실패한다.
 */
export function firstH3PlainTextInFirstSubtitleSection(html: string): string | null {
  const t = String(html ?? "");
  const rootM = /<(?:div|section)\b[^>]*\bclass\s*=\s*["'][^"']*\bsubtitle-section\b[^"']*["'][^>]*>/i.exec(t);
  if (!rootM) return null;
  const win = t.slice(rootM.index, rootM.index + 12000);
  const h3m = /<h3\b[^>]*>([\s\S]*?)<\/h3>/i.exec(win);
  if (!h3m) return null;
  return fortuneHtmlFragmentPlainText(h3m[1] ?? "");
}

/**
 * `html` 안 첫 `<h3 class="subtitle-title">` 표시 텍스트가 `plain`과 같으면 true.
 */
export function firstSubtitleTitlePlainTextEquals(html: string, plain: string): boolean {
  const want = normFortunePlainTextForCompare(plain);
  if (!want) return false;
  const t = String(html ?? "");
  const re = /<h3\b[^>]*\bsubtitle-title\b[^>]*>([\s\S]*?)<\/h3>/i;
  const m = re.exec(t);
  if (!m) return false;
  const got = normFortunePlainTextForCompare(m[1] ?? "");
  return got === want;
}

/**
 * 첫 소제목 블록의 첫 h3 텍스트가 `mainLabel`과 같으면 true (`split` 유무·클래스 변형 대응).
 */
export function mainTitleDuplicatedAsFirstSubtitleH3(html: string, mainLabel: string): boolean {
  const loose = firstH3PlainTextInFirstSubtitleSection(html);
  if (loose === null) return firstSubtitleTitlePlainTextEquals(html, mainLabel);
  const nh = normFortunePlainTextForCompare(loose);
  const nm = normFortunePlainTextForCompare(mainLabel);
  if (!nm || !nh) return false;
  if (nh === nm) return true;
  return fortunePlainCompact(loose) === fortunePlainCompact(mainLabel);
}

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
