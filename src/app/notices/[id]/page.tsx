import { notFound } from "next/navigation";

import { NoticeDetailClient } from "@/components/notices/NoticeDetailClient";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";
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

export default async function NoticeDetailPage({ params }: Props) {
  const { id } = await params;
  const n = getNoticeById(id);
  if (!n) notFound();

  return (
    <>
      <MyTabBackdrop />
      <div className="y-history-route-live">
        <NoticeDetailClient notice={n} />
      </div>
    </>
  );
}
