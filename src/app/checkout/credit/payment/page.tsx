import Link from "next/link";

export const metadata = {
  title: "결제하기 | 연운 緣運",
  description: "결제를 진행하세요.",
};

export default function CreditPaymentPage() {
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "18px 20px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h1 style={{ fontFamily: '"Noto Serif KR", serif', fontSize: 18, fontWeight: 700, color: "var(--y-ink)" }}>
          결제하기
        </h1>
        <Link href="/checkout/credit" style={{ color: "var(--y-mute)", textDecoration: "none", fontSize: 12 }}>
          뒤로
        </Link>
      </div>

      <div style={{ background: "white", border: "0.5px solid var(--y-line)", borderRadius: 14, padding: "14px 14px 12px" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.18em", fontWeight: 700, color: "var(--y-rose)" }}>PAYMENT</div>
        <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--y-mute)", lineHeight: 1.7 }}>
          목업 단계용 결제 화면입니다. PG 연동은 추후 연결합니다.
        </p>
        <Link
          href="/my"
          style={{
            marginTop: 12,
            display: "inline-flex",
            width: "100%",
            justifyContent: "center",
            padding: 14,
            borderRadius: 999,
            background: "var(--y-rose)",
            color: "white",
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          결제 완료(목업) → 마이로 이동
        </Link>
      </div>
    </main>
  );
}

