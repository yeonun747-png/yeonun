import Link from "next/link";

import { TopNav } from "@/components/TopNav";

export const metadata = {
  title: "텍스트 대화 기록 | 연운 緣運",
  description: "텍스트 대화 기록",
};

export default function ChatHistoryPage() {
  return (
    <div className="yeonunPage">
      <TopNav />
      <main style={{ padding: "18px 20px 40px" }}>
        <div className="yAllSectionName" style={{ padding: 0 }}>
          텍스트 대화 기록
        </div>
        <p className="yAllSectionDesc" style={{ padding: "6px 0 14px" }}>
          목업 단계용 화면입니다. 텍스트 대화 기록은 추후 연결됩니다.
        </p>
        <Link href="/meet" style={{ fontSize: 12, color: "var(--y-rose)", textDecoration: "none", fontWeight: 700 }}>
          안내자 만나러 가기 →
        </Link>
      </main>
    </div>
  );
}

