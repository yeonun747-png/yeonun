import Link from "next/link";

import { TopNav } from "@/components/TopNav";

export const metadata = {
  title: "결제 내역 | 연운 緣運",
  description: "결제 내역 확인",
};

export default function PaymentsPage() {
  return (
    <div className="yeonunPage">
      <TopNav />
      <main style={{ padding: "18px 20px 40px" }}>
        <div className="yAllSectionName" style={{ padding: 0 }}>
          결제 내역
        </div>
        <p className="yAllSectionDesc" style={{ padding: "6px 0 14px" }}>
          목업 단계용 화면입니다. 결제 내역은 추후 PG/DB 연동으로 표시됩니다.
        </p>
        <Link href="/checkout/credit" style={{ fontSize: 12, color: "var(--y-rose)", textDecoration: "none", fontWeight: 700 }}>
          크레딧 충전 →
        </Link>
      </main>
    </div>
  );
}

