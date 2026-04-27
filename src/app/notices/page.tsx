import Link from "next/link";

import { TopNav } from "@/components/TopNav";

export const metadata = {
  title: "공지사항 | 연운 緣運",
  description: "연운 공지사항",
};

export default function NoticesPage() {
  return (
    <div className="yeonunPage">
      <TopNav />
      <main style={{ padding: "18px 20px 40px" }}>
        <div className="yAllSectionName" style={{ padding: 0 }}>
          공지사항
        </div>
        <p className="yAllSectionDesc" style={{ padding: "6px 0 14px" }}>
          목업 단계용 화면입니다. 공지 목록은 추후 CMS/DB로 연결됩니다.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          {["2026 신년 이벤트 안내", "서비스 점검 공지", "업데이트 안내"].map((t) => (
            <div key={t} style={{ background: "white", border: "0.5px solid var(--y-line)", borderRadius: 14, padding: "14px 14px 12px" }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--y-ink)" }}>{t}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--y-mute)" }}>자세한 내용은 추후 반영됩니다.</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <Link href="/my" style={{ fontSize: 12, color: "var(--y-mute)", textDecoration: "none" }}>
            ← 마이로
          </Link>
        </div>
      </main>
    </div>
  );
}

