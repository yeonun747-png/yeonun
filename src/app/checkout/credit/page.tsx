import Link from "next/link";

export const metadata = {
  title: "크레딧 충전 | 연운 緣運",
  description: "음성상담 크레딧을 충전하세요.",
};

const PACKS = [
  { min: 10, price: 3900, bonus: "첫 충전 10% 추가" },
  { min: 30, price: 9900, bonus: "15%↓" },
  { min: 60, price: 17900, bonus: "24%↓" },
];

export default function CreditCheckoutPage() {
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "18px 20px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h1 style={{ fontFamily: '"Noto Serif KR", serif', fontSize: 18, fontWeight: 700, color: "var(--y-ink)" }}>
          크레딧 충전
        </h1>
        <Link href="/my" style={{ color: "var(--y-mute)", textDecoration: "none", fontSize: 12 }}>
          닫기
        </Link>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {PACKS.map((p) => (
          <Link
            key={p.min}
            href="/checkout/credit/payment"
            style={{
              background: "white",
              border: "0.5px solid var(--y-line)",
              borderRadius: 14,
              padding: "14px 14px 12px",
              textDecoration: "none",
              color: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontFamily: '"Noto Serif KR", serif', fontSize: 14, fontWeight: 700, color: "var(--y-ink)" }}>
                {p.min}분 패키지
              </div>
              <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--y-mute)" }}>{p.bonus}</div>
            </div>
            <div style={{ fontFamily: '"Noto Serif KR", serif', fontSize: 14, fontWeight: 700, color: "var(--y-rose)" }}>
              {p.price.toLocaleString("ko-KR")}원
            </div>
          </Link>
        ))}
      </div>

      <p style={{ marginTop: 14, fontSize: 11.5, color: "var(--y-mute)", lineHeight: 1.7 }}>
        결제 화면은 목업 단계용으로 연결만 되어 있습니다.
      </p>
    </main>
  );
}

