import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";

export const metadata = {
  title: "검색 | 연운 緣運",
  description: "연운의 풀이와 안내자를 검색하세요.",
};

export default function SearchPage() {
  return (
    <div className="yeonunPage">
      <TopNav />
      <main style={{ padding: "18px 20px 90px" }}>
        <div className="yAllSectionName" style={{ padding: 0 }}>
          검색
        </div>
        <p className="yAllSectionDesc" style={{ padding: "6px 0 14px" }}>
          안내자·풀이 제목·태그로 찾아보세요.
        </p>
        <div
          style={{
            background: "white",
            border: "0.5px solid var(--y-line)",
            borderRadius: 14,
            padding: "14px 14px 12px",
          }}
        >
          <div style={{ fontSize: 10, color: "var(--y-mute)", letterSpacing: "0.18em", fontWeight: 700 }}>
            SEARCH
          </div>
          <div style={{ marginTop: 8 }}>
            <input
              placeholder="예: 재회, 토정비결, 연화…"
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                fontFamily: '"Noto Serif KR", serif',
                fontSize: 15,
                color: "var(--y-ink)",
                background: "transparent",
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 18, fontSize: 12.5, color: "var(--y-mute)", lineHeight: 1.7 }}>
          검색 결과 화면은 다음 단계에서 DB 연동으로 완성합니다.
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

