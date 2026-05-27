"use client";

import { useCallback, useEffect, useState } from "react";

const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeYlpS_ODRAoFE9tIhJvI2qo7qakhiZXyDxgCTTlbnhwy6NBw/viewform";

const COUNTDOWN_SECONDS = 3;

export function BetaPageClient() {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

  const goToForm = useCallback(() => {
    window.location.assign(GOOGLE_FORM_URL);
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) {
      goToForm();
      return;
    }
    const timer = window.setTimeout(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft, goToForm]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px 48px",
        background: "#f6f1eb",
        textAlign: "center",
        color: "#2a2420",
      }}
    >
      <div
        style={{
          fontFamily: '"Noto Serif KR", serif',
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}
        aria-label="연운"
      >
        <span style={{ color: "#2a2420" }}>연운</span>
        <span style={{ marginLeft: 6, color: "#8b7355", fontWeight: 500 }}>緣運</span>
      </div>

      <h1
        style={{
          marginTop: 28,
          fontFamily: '"Noto Serif KR", serif',
          fontSize: 20,
          fontWeight: 600,
          lineHeight: 1.5,
        }}
      >
        베타 테스트에 초대되셨습니다
      </h1>

      <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: "#6b5f56" }}>
        잠시 후 이동합니다...
      </p>

      <p style={{ marginTop: 8, fontSize: 13, color: "#8b7355" }}>
        자동으로 이동됩니다... {secondsLeft > 0 ? `${secondsLeft}초` : ""}
      </p>

      <button
        type="button"
        onClick={goToForm}
        style={{
          marginTop: 32,
          padding: "14px 22px",
          border: "none",
          borderRadius: 999,
          background: "#2a2420",
          color: "#f6f1eb",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        지금 바로 이동하기 →
      </button>
    </main>
  );
}
