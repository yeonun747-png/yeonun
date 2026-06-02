import { MyCreditUsagePageClient } from "@/components/my/MyCreditUsagePageClient";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";

export const metadata = {
  title: "이용 내역 | 연운 緣運",
  description: "크레딧 적립·사용 내역 확인",
};

export default function CreditUsagePage() {
  return (
    <>
      <MyTabBackdrop />
      <MyCreditUsagePageClient />
    </>
  );
}
