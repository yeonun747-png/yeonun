"use client";

import { MySheetLink } from "@/components/my/MySheetLink";
import { MySubpageSheet } from "@/components/my/MySubpageSheet";
import { NOTICES_MOCK } from "@/lib/notices-mock";

function badgeLabel(b: string) {
  if (b === "event") return "이벤트";
  if (b === "update") return "업데이트";
  return "공지";
}

function badgeClass(b: string) {
  if (b === "event") return "y-notice-badge event";
  if (b === "update") return "y-notice-badge update";
  return "y-notice-badge notice";
}

export function NoticesListClient() {
  return (
    <MySubpageSheet title="공지사항" ariaLabel="공지사항">
      <div className="y-sub-scroll-page">
        {NOTICES_MOCK.map((n) => (
          <MySheetLink key={n.id} href={`/notices/${n.id}`} className="y-notice-item">
            <div>
              <span className={badgeClass(n.badge)}>{badgeLabel(n.badge)}</span>
              {n.showNewDot ? <span className="y-notice-new" aria-label="새 글" /> : null}
            </div>
            <div className="y-notice-title">{n.title}</div>
            <div className="y-notice-date">{n.date}</div>
          </MySheetLink>
        ))}
        <div style={{ height: 40 }} />
      </div>
    </MySubpageSheet>
  );
}
