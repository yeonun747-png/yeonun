import { CallHistoryClient } from "@/components/history/CallHistoryClient";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";

export const metadata = {
  title: "음성상담 보관함 | 연운 緣運",
  description: "종료된 음성 상담 목록과 대화 글(전사)을 60일간 확인합니다.",
};

export default function CallHistoryPage() {
  return (
    <>
      <MyTabBackdrop />
      <CallHistoryClient />
    </>
  );
}
