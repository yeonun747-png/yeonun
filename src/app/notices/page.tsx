import { NoticesListClient } from "@/components/notices/NoticesListClient";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";

export const metadata = {
  title: "공지사항 | 연운 緣運",
  description: "연운 공지사항",
};

export default function NoticesPage() {
  return (
    <>
      <MyTabBackdrop />
      <div className="y-history-route-live">
        <NoticesListClient />
      </div>
    </>
  );
}
