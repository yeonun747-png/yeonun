import Link from "next/link";

import { TopNav } from "@/components/TopNav";

export const metadata = {
  title: "보관함 | 연운 緣運",
  description: "구매한 풀이 보관함",
};

export default function LibraryPage() {
  return (
    <div className="yeonunPage">
      <TopNav />
      <main style={{ padding: "18px 20px 40px" }}>
        <div className="yAllSectionName" style={{ padding: 0 }}>
          보관함
        </div>
        <p className="yAllSectionDesc" style={{ padding: "6px 0 14px" }}>
          목업 단계용 화면입니다. 구매한 풀이 목록은 추후 DB 연동으로 채워집니다.
        </p>
        <Link href="/content" style={{ fontSize: 12, color: "var(--y-rose)", textDecoration: "none", fontWeight: 700 }}>
          풀이 둘러보기 →
        </Link>
      </main>
    </div>
  );
}

