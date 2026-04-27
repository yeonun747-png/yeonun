import Link from "next/link";

export const metadata = {
  title: "제휴 문의 | 연운 緣運",
  description: "연운 제휴 문의 안내",
};

export default function PartnerPage() {
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "24px 20px 40px", lineHeight: 1.8 }}>
      <h1 style={{ fontFamily: '"Noto Serif KR", serif', fontSize: 20, fontWeight: 700, color: "var(--y-ink)" }}>
        제휴 문의
      </h1>
      <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--y-mute)" }}>
        목업 단계용 페이지입니다. 제휴 안내/문의 폼은 추후 반영됩니다.
      </p>
      <div style={{ marginTop: 14 }}>
        <Link href="/" style={{ fontSize: 12, color: "var(--y-mute)", textDecoration: "none" }}>
          ← 홈으로
        </Link>
      </div>
    </main>
  );
}

