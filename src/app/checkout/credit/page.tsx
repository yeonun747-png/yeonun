import { CreditChargeMockClient } from "@/components/checkout/CreditChargeMockClient";

export const metadata = {
  title: "크레딧 충전 | 연운 緣運",
  description: "음성상담 크레딧을 충전하세요.",
};

export default function CreditCheckoutPage() {
  return <CreditChargeMockClient />;
}
