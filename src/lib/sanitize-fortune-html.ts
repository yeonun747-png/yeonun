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
];

/** LLM 점사 HTML — XSS 방지용 allowlist sanitize */
export function sanitizeFortuneHtml(html: string): string {
  const raw = String(html ?? "");
  if (!raw.trim()) return "";
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: FORTUNE_HTML_ALLOWED_TAGS,
    ALLOWED_ATTR: FORTUNE_HTML_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
  });
}
