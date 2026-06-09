import { InvitePageClient } from "@/components/invite/InvitePageClient";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";

export const metadata = {
  title: "친구 초대 | 연운 緣運",
  description: "친구를 초대하고 음성 상담 크레딧을 함께 받아요",
};

export default function InvitePage() {
  return (
    <>
      <MyTabBackdrop />
      <div className="y-history-route-live">
        <InvitePageClient />
      </div>
    </>
  );
}
