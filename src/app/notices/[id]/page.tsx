import Link from "next/link";
import { notFound } from "next/navigation";

import { TopNav } from "@/components/TopNav";
import { getNoticeById, NOTICES_MOCK } from "@/lib/notices-mock";

export function generateStaticParams() {
  return NOTICES_MOCK.map((n) => ({ id: n.id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const n = getNoticeById(id);
  if (!n) return { title: "공지사항 | 연운 緣運" };
  return { title: `${n.title} | 공지 | 연운 緣運`, robots: { index: false, follow: true } };
}

function badgeClass(b: string): string {
  if (b === "event") return "y-notice-badge event";
  if (b === "update") return "y-notice-badge update";
  return "y-notice-badge notice";
}

export default async function NoticeDetailPage({ params }: Props) {
  const { id } = await params;
  const n = getNoticeById(id);
  if (!n) notFound();

  return (
    <div className="yeonunPage">
      <TopNav />
      <header className="y-page-sub-head">
        <Link href="/notices" className="y-page-sub-back" aria-label="공지 목록">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </Link>
        <h1 className="y-page-sub-title">공지사항</h1>
        <span className="y-page-sub-spacer" aria-hidden />
      </header>

      <div className="y-sub-scroll-page">
        <article className="y-notice-detail">
          <div className="y-notice-detail-badge">
            <span className={badgeClass(n.badge)}>
              {n.badge === "event" ? "이벤트" : n.badge === "update" ? "업데이트" : "공지"}
            </span>
          </div>
          <h2 className="y-notice-detail-title">{n.title}</h2>
          <div className="y-notice-detail-date">{n.date}</div>
          <div className="y-notice-detail-body" dangerouslySetInnerHTML={{ __html: n.bodyHtml }} />
        </article>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
