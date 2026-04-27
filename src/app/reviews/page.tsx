import Link from "next/link";

import { TopNav } from "@/components/TopNav";

export const metadata = {
  title: "후기 | 연운 緣運",
  description: "연운 사용자 후기 모음",
};

export default function ReviewsPage() {
  return (
    <div className="yeonunPage">
      <TopNav />
      <main style={{ padding: "18px 20px 40px" }}>
        <div className="yAllSectionName" style={{ padding: 0 }}>
          후기
        </div>
        <p className="yAllSectionDesc" style={{ padding: "6px 0 14px" }}>
          전체 후기 화면은 다음 단계에서 상품별/필터/무한스크롤로 완성합니다.
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                background: "white",
                border: "0.5px solid var(--y-line)",
                borderRadius: 14,
                padding: "14px 14px 12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--y-ink)" }}>u*{idx}</div>
                <div style={{ fontSize: 11, color: "var(--y-mute)" }}>★ 4.{9 - (idx % 3)}</div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--y-mute)", lineHeight: 1.7 }}>
                목업 단계용 더미 후기입니다. 실제 데이터는 Supabase에서 불러오도록 연결합니다.
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--y-rose)", fontWeight: 600 }}>
                #재회 #흐름 #상담
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <Link href="/" style={{ fontSize: 12, color: "var(--y-mute)", textDecoration: "none" }}>
            ← 홈으로
          </Link>
        </div>
      </main>
    </div>
  );
}

