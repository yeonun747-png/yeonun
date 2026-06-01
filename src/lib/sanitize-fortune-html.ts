import DOMPurify from "isomorphic-dompurify";

const FORTUNE_HTML_ALLOWED_TAGS = [
  "div",
  "span",
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "b",
  "i",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "blockquote",
  "hr",
  "img",
  "a",
  "section",
  "article",
  "header",
  "footer",
  "small",
  "sub",
  "sup",
];

const FORTUNE_HTML_ALLOWED_ATTR = [
  "class",
  "id",
  "href",
  "target",
  "rel",
  "src",
  "alt",
  "title",
  "colspan",
  "rowspan",
  "aria-hidden",
  "role",
  "data-section-id",
  "data-subtitle-id",
  "style",
];

/** LLM 점사 표 셀 색·테두리 등 — url()/expression 등은 차단 */
const FORTUNE_HTML_ALLOWED_STYLE_PROPS = new Set([
  "background",
  "background-color",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-color",
  "border-width",
  "border-style",
  "border-collapse",
  "color",
  "font-weight",
  "text-align",
  "vertical-align",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "width",
  "max-width",
]);

const UNSAFE_STYLE_VALUE =
  /expression|javascript|vbscript|behavior|-moz-binding|@import|url\s*\(|var\s*\(|calc\s*\([^)]*url/i;

function sanitizeFortuneInlineStyle(styleValue: string): string {
  return String(styleValue ?? "")
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const colon = chunk.indexOf(":");
      if (colon <= 0) return null;
      const prop = chunk.slice(0, colon).trim().toLowerCase();
      const val = chunk.slice(colon + 1).trim();
      if (!FORTUNE_HTML_ALLOWED_STYLE_PROPS.has(prop)) return null;
      if (!val || UNSAFE_STYLE_VALUE.test(val)) return null;
      return `${prop}: ${val}`;
    })
    .filter(Boolean)
    .join("; ");
}

let fortuneStyleHookInstalled = false;

function ensureFortuneStyleSanitizeHook(): void {
  if (fortuneStyleHookInstalled) return;
  fortuneStyleHookInstalled = true;
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName !== "style") return;
    const safe = sanitizeFortuneInlineStyle(data.attrValue);
    if (!safe) {
      data.keepAttr = false;
      return;
    }
    data.attrValue = safe;
  });
}

/** LLM 점사 HTML — XSS 방지용 allowlist sanitize */
export function sanitizeFortuneHtml(html: string): string {
  const raw = String(html ?? "");
  if (!raw.trim()) return "";
  ensureFortuneStyleSanitizeHook();
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: FORTUNE_HTML_ALLOWED_TAGS,
    ALLOWED_ATTR: FORTUNE_HTML_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
  });
}
