export default function AdminLoginPage() {
  return (
    <div className="yeonunPage">
      <main style={{ padding: "22px 20px" }}>
        <h1 style={{ fontFamily: '"Noto Serif KR", serif', fontSize: 20, fontWeight: 600 }}>
          어드민 로그인
        </h1>
        <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--y-mute)", lineHeight: 1.6 }}>
          관리자 비밀번호를 입력하세요.
        </p>

        <form action="/admin/login/action" method="post" style={{ marginTop: 16 }}>
          <input
            name="password"
            type="password"
            placeholder="Admin password"
            style={{
              width: "100%",
              padding: "14px 14px",
              borderRadius: 12,
              border: "0.5px solid var(--y-line)",
              background: "white",
              fontSize: 13,
            }}
          />
          <button
            type="submit"
            style={{
              width: "100%",
              marginTop: 12,
              padding: "14px",
              borderRadius: 999,
              border: "none",
              background: "var(--y-ink)",
              color: "white",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            로그인
          </button>
        </form>
      </main>
    </div>
  );
}

