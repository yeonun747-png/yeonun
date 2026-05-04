"use client";

import { MySubpageSheet } from "@/components/my/MySubpageSheet";
import type { NoticeMock } from "@/lib/notices-mock";

function badgeClass(b: string): string {
  if (b === "event") return "y-notice-badge event";
  if (b === "update") return "y-notice-badge update";
  return "y-notice-badge notice";
}

export function NoticeDetailClient({ notice }: { notice: NoticeMock }) {
  return (
    <MySubpageSheet title="공지사항" ariaLabel="공지사항" backHref="/notices">
      <div className="y-sub-scroll-page">
        <article className="y-notice-detail">
          <div className="y-notice-detail-badge">
            <span className={badgeClass(notice.badge)}>
              {notice.badge === "event" ? "이벤트" : notice.badge === "update" ? "업데이트" : "공지"}
            </span>
          </div>
          <h2 className="y-notice-detail-title">{notice.title}</h2>
          <div className="y-notice-detail-date">{notice.date}</div>
          <div className="y-notice-detail-body" dangerouslySetInnerHTML={{ __html: notice.bodyHtml }} />
        </article>
        <div style={{ height: 40 }} />
      </div>
    </MySubpageSheet>
  );
}
