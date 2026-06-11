export const NOTICE_READS_CHANGED_EVENT = "yeonun:notice-reads-changed";

const STORAGE_KEY = "yeonun_notice_reads_v1";

export type NoticeReadItem = {
  slug: string;
  title: string;
  showNewDot: boolean;
  /** YYYY-MM-DD — 목록·메뉴 부제 정렬용 */
  publishedOn?: string;
  sortOrder?: number;
};

export function readNoticeSlugsFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((s): s is string => typeof s === "string"));
  } catch {
    return new Set();
  }
}

export function mergeNoticeSlugsIntoStorage(slugs: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const set = readNoticeSlugsFromStorage();
    let changed = false;
    for (const slug of slugs) {
      if (!slug || set.has(slug)) continue;
      set.add(slug);
      changed = true;
    }
    if (!changed) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    window.dispatchEvent(new CustomEvent(NOTICE_READS_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

export function markNoticeReadInStorage(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    const set = readNoticeSlugsFromStorage();
    if (set.has(slug)) return;
    set.add(slug);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    window.dispatchEvent(new CustomEvent(NOTICE_READS_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

function compareNoticeReadItemsByDateDesc(a: NoticeReadItem, b: NoticeReadItem): number {
  const dateDiff = (b.publishedOn ?? "").localeCompare(a.publishedOn ?? "");
  if (dateDiff !== 0) return dateDiff;
  return a.title.localeCompare(b.title);
}

export function getUnreadNotices(notices: NoticeReadItem[], readSlugs: Set<string> = readNoticeSlugsFromStorage()) {
  const sorted = [...notices].sort(compareNoticeReadItemsByDateDesc);
  return sorted.filter((n) => n.showNewDot && !readSlugs.has(n.slug));
}

export function countUnreadNotices(notices: NoticeReadItem[], readSlugs?: Set<string>): number {
  return getUnreadNotices(notices, readSlugs).length;
}

/** 마이탭 메뉴 부제·배지용 */
export function noticeMenuMeta(notices: NoticeReadItem[]) {
  const readSlugs = readNoticeSlugsFromStorage();
  const unread = getUnreadNotices(notices, readSlugs);
  const unreadCount = unread.length;
  const latest = [...notices].sort(compareNoticeReadItemsByDateDesc)[0];

  let desc = "이벤트 · 운영 안내";
  if (unreadCount === 1) {
    desc = unread[0]!.title;
  } else if (unreadCount > 1) {
    desc = `${unread[0]!.title} 외 ${unreadCount - 1}건`;
  } else if (latest?.title) {
    desc = latest.title;
  }

  return { unreadCount, desc };
}
