export const metadata = {
  title: "연운 소개 | 연운 緣運",
  description: "연운 서비스 소개",
};

export default function AboutPage() {
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "24px 20px 40px", lineHeight: 1.8 }}>
      <h1 style={{ fontFamily: '"Noto Serif KR", serif', fontSize: 20, fontWeight: 700, color: "var(--y-ink)" }}>
        연운 소개
      </h1>
      <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--y-mute)" }}>
        목업 단계용 소개 페이지입니다. 브랜드 스토리/팀/철학/연락처는 추후 반영됩니다.
      </p>
    </main>
  );
}

