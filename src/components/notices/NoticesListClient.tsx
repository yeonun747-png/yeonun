"use client";

import { useEffect, useMemo, useState } from "react";

import { MySheetLink } from "@/components/my/MySheetLink";
import { MySubpageSheet } from "@/components/my/MySubpageSheet";
import { readNoticeSlugsFromStorage } from "@/lib/notice-reads";
import { noticeBadgeClass, noticeCategoryLabel, type NoticeView } from "@/lib/notices-types";

type Props = {
  notices: NoticeView[];
};

export function NoticesListClient({ notices }: Props) {
  const [readSlugs, setReadSlugs] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setReadSlugs(readNoticeSlugsFromStorage());
  }, []);

  const sorted = useMemo(
    () =>
      [...notices].sort((a, b) => {
        if (b.sortOrder !== a.sortOrder) return b.sortOrder - a.sortOrder;
        return b.date.localeCompare(a.date);
      }),
    [notices],
  );

  return (
    <MySubpageSheet title="공지사항" ariaLabel="공지사항">
      <div className="y-sub-scroll-page">
        {sorted.length === 0 ? (
          <p className="y-notice-empty">등록된 공지가 없습니다.</p>
        ) : (
          <ul className="y-notice-list">
            {sorted.map((n) => {
              const unread = n.showNewDot && !readSlugs.has(n.slug);
              return (
                <li key={n.slug} className="y-notice-list-item">
                  <MySheetLink href={`/notices/${encodeURIComponent(n.slug)}`} className="y-notice-item">
                    <div className="y-notice-item-top">
                      <span className={noticeBadgeClass(n.category)}>{noticeCategoryLabel(n.category)}</span>
                      {unread ? <span className="y-notice-new" aria-label="읽지 않음" /> : null}
                    </div>
                    <div className="y-notice-title">{n.title}</div>
                    <div className="y-notice-date">{n.date}</div>
                  </MySheetLink>
                </li>
              );
            })}
          </ul>
        )}
        <div style={{ height: 40 }} />
      </div>
    </MySubpageSheet>
  );
}
