export const NOTICE_READS_CHANGED_EVENT = "yeonun:notice-reads-changed";

const STORAGE_KEY = "yeonun_notice_reads_v1";

export type NoticeReadItem = {
  slug: string;
  title: string;
  showNewDot: boolean;
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

export function getUnreadNotices(notices: NoticeReadItem[], readSlugs: Set<string> = readNoticeSlugsFromStorage()) {
  const sorted = [...notices].sort((a, b) => {
    const orderDiff = (b.sortOrder ?? 0) - (a.sortOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.title.localeCompare(b.title);
  });
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
  const latest = [...notices].sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0))[0];

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
