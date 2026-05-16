import { NoticesListClient } from "@/components/notices/NoticesListClient";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";
import { listPublishedNotices } from "@/lib/notices";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "공지사항 | 연운 緣運",
  description: "연운 공지사항 — 이벤트, 업데이트, 운영 안내",
};

export default async function NoticesPage() {
  const notices = await listPublishedNotices();

  return (
    <>
      <MyTabBackdrop />
      <div className="y-history-route-live">
        <NoticesListClient notices={notices} />
      </div>
    </>
  );
}
