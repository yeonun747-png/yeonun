import Link from "next/link";

import { TopNav } from "@/components/TopNav";

export const metadata = {
  title: "알림 설정 | 연운 緣運",
  description: "알림 설정",
};

export default function NotificationSettingsPage() {
  return (
    <div className="yeonunPage">
      <TopNav />
      <main style={{ padding: "18px 20px 40px" }}>
        <div className="yAllSectionName" style={{ padding: 0 }}>
          알림 설정
        </div>
        <p className="yAllSectionDesc" style={{ padding: "6px 0 14px" }}>
          목업 단계용 화면입니다. 알림 토글은 추후 계정 연동으로 저장됩니다.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          {[
            { title: "매일 한 마디", desc: "안내자의 하루 메시지" },
            { title: "길조 알림", desc: "좋은 날/좋은 시간 알림" },
          ].map((x) => (
            <div key={x.title} style={{ background: "white", border: "0.5px solid var(--y-line)", borderRadius: 14, padding: "14px 14px 12px" }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--y-ink)" }}>{x.title}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--y-mute)" }}>{x.desc}</div>
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

