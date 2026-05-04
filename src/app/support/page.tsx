import { SupportMockClient } from "@/components/support/SupportMockClient";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";

export const metadata = {
  title: "고객센터 | 연운 緣運",
  description: "연운 고객센터 안내",
};

export default function SupportPage() {
  return (
    <>
      <MyTabBackdrop />
      <SupportMockClient />
    </>
  );
}
