import { notFound } from "next/navigation";

import { NoticeDetailClient } from "@/components/notices/NoticeDetailClient";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";
import { getPublishedNoticeBySlug } from "@/lib/notices";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const n = await getPublishedNoticeBySlug(slug);
  if (!n) return { title: "공지사항 | 연운 緣運" };
  return { title: `${n.title} | 공지 | 연운 緣運`, robots: { index: false, follow: true } };
}

export default async function NoticeDetailPage({ params }: Props) {
  const { slug } = await params;
  const notice = await getPublishedNoticeBySlug(slug);
  if (!notice) notFound();

  return (
    <>
      <MyTabBackdrop />
      <div className="y-history-route-live">
        <NoticeDetailClient notice={notice} />
      </div>
    </>
  );
}
