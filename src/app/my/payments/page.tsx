import { MyPaymentsPageClient } from "@/components/my/MyPaymentsPageClient";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";

export const metadata = {
  title: "결제 내역 | 연운 緣運",
  description: "결제 내역 확인",
};

export default function PaymentsPage() {
  return (
    <>
      <MyTabBackdrop />
      <MyPaymentsPageClient />
    </>
  );
}
