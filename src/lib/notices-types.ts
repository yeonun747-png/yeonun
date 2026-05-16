export type NoticeCategory = "event" | "update" | "notice";

export type NoticeView = {
  slug: string;
  category: NoticeCategory;
  title: string;
  date: string;
  bodyHtml: string;
  showNewDot: boolean;
  sortOrder: number;
};

export function escapeNoticeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function noticeBodyToHtml(body: string): string {
  const blocks = body.trim().split(/\n\n+/).filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trimEnd());
      const first = lines[0] ?? "";
      if (/^\[.+\]$/.test(first)) {
        const heading = first.slice(1, -1);
        const rest = lines.slice(1);
        const inner = rest.length
          ? `<br />${rest.map((line) => escapeNoticeHtml(line)).join("<br />")}`
          : "";
        return `<p><strong>${escapeNoticeHtml(heading)}</strong>${inner}</p>`;
      }
      return `<p>${lines.map((line) => escapeNoticeHtml(line)).join("<br />")}</p>`;
    })
    .join("");
}

export function formatNoticeDate(publishedOn: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(publishedOn);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  return publishedOn;
}

export function noticeCategoryLabel(category: NoticeCategory): string {
  if (category === "event") return "이벤트";
  if (category === "update") return "업데이트";
  return "공지";
}

export function noticeBadgeClass(category: NoticeCategory): string {
  return `y-notice-badge ${category}`;
}
