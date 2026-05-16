import "server-only";

import { NOTICES_SEED_DATA } from "@/lib/notices-seed-data";
import {
  formatNoticeDate,
  noticeBodyToHtml,
  type NoticeCategory,
  type NoticeView,
} from "@/lib/notices-types";
import { supabaseServer } from "@/lib/supabase/server";

export type { NoticeCategory, NoticeView } from "@/lib/notices-types";
export { noticeBadgeClass, noticeCategoryLabel, noticeBodyToHtml, formatNoticeDate } from "@/lib/notices-types";

type NoticeRecord = {
  slug: string;
  category: NoticeCategory;
  title: string;
  published_on: string;
  body: string;
  is_published: boolean;
  show_new_dot: boolean;
  sort_order: number;
};

const NOTICE_SELECT =
  "slug,category,title,published_on,body,is_published,show_new_dot,sort_order";

function rowToView(row: NoticeRecord): NoticeView {
  return {
    slug: row.slug,
    category: row.category,
    title: row.title,
    date: formatNoticeDate(row.published_on),
    bodyHtml: noticeBodyToHtml(row.body),
    showNewDot: row.show_new_dot,
    sortOrder: row.sort_order,
  };
}

function seedFallback(): NoticeView[] {
  return NOTICES_SEED_DATA.map((n) => ({
    slug: n.slug,
    category: n.category,
    title: n.title,
    date: formatNoticeDate(n.published_on),
    bodyHtml: noticeBodyToHtml(n.body),
    showNewDot: n.show_new_dot,
    sortOrder: n.sort_order,
  }));
}

function parseRows(data: unknown): NoticeRecord[] {
  if (!Array.isArray(data)) return [];
  return data as NoticeRecord[];
}

export async function listPublishedNotices(): Promise<NoticeView[]> {
  try {
    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from("notices")
      .select(NOTICE_SELECT)
      .eq("is_published", true)
      .order("sort_order", { ascending: false })
      .order("published_on", { ascending: false });

    if (error || !data?.length) {
      return seedFallback();
    }
    return parseRows(data).map(rowToView);
  } catch {
    return seedFallback();
  }
}

export async function getPublishedNoticeBySlug(rawSlug: string): Promise<NoticeView | null> {
  const slug = decodeURIComponent(rawSlug).trim();
  if (!slug) return null;

  try {
    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from("notices")
      .select(NOTICE_SELECT)
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (!error && data) {
      return rowToView(data as NoticeRecord);
    }
    return seedFallback().find((n) => n.slug === slug) ?? null;
  } catch {
    return seedFallback().find((n) => n.slug === slug) ?? null;
  }
}
