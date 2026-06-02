"use client";

import { useEffect } from "react";

import { MySubpageSheet } from "@/components/my/MySubpageSheet";
import { markNoticeRead } from "@/lib/notice-reads-sync";
import { noticeBadgeClass, noticeCategoryLabel, type NoticeView } from "@/lib/notices-types";
import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import { asHtmlString } from "@/lib/as-html-string";

export function NoticeDetailClient({ notice }: { notice: NoticeView }) {
  const { session } = useYeonunAuth();

  useEffect(() => {
    markNoticeRead(notice.slug, session?.access_token ?? null);
  }, [notice.slug, session?.access_token]);

  return (
    <MySubpageSheet title="공지사항" ariaLabel="공지사항" backHref="/notices">
      <div className="y-sub-scroll-page">
        <article className="y-notice-detail">
          <div className="y-notice-detail-badge">
            <span className={noticeBadgeClass(notice.category)}>{noticeCategoryLabel(notice.category)}</span>
          </div>
          <h1 className="y-notice-detail-title">{notice.title}</h1>
          <div className="y-notice-detail-date">{notice.date}</div>
          <div className="y-notice-detail-body" dangerouslySetInnerHTML={{ __html: asHtmlString(notice.bodyHtml) }} />
        </article>
        <div style={{ height: 40 }} />
      </div>
    </MySubpageSheet>
  );
}
