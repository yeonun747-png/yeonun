import Link from "next/link";

import { TopNav } from "@/components/TopNav";
import { NOTICES_MOCK } from "@/lib/notices-mock";

export const metadata = {
  title: "공지사항 | 연운 緣運",
  description: "연운 공지사항",
};

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

export default function NoticesPage() {
  return (
    <div className="yeonunPage">
      <TopNav />
      <header className="y-page-sub-head">
        <Link href="/my" className="y-page-sub-back" aria-label="마이로">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </Link>
        <h1 className="y-page-sub-title">공지사항</h1>
        <span className="y-page-sub-spacer" aria-hidden />
      </header>

      <div className="y-sub-scroll-page">
        {NOTICES_MOCK.map((n) => (
          <Link key={n.id} href={`/notices/${n.id}`} className="y-notice-item">
            <div>
              <span className={badgeClass(n.badge)}>{badgeLabel(n.badge)}</span>
              {n.showNewDot ? <span className="y-notice-new" aria-label="새 글" /> : null}
            </div>
            <div className="y-notice-title">{n.title}</div>
            <div className="y-notice-date">{n.date}</div>
          </Link>
        ))}
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
