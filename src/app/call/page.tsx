"use client";

import { useMemo, useState } from "react";

export default function CallPage() {
  const [muted, setMuted] = useState(false);
  const bars = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);
  const [activeLine, setActiveLine] = useState<"tts" | "stt">("tts");
  const [ended, setEnded] = useState(false);

  if (ended) {
    return (
      <div className="yeonunPage">
        <main className="y-call-end-screen" aria-label="상담 종료 요약">
          <div className="y-call-end-hero">
            <div className="y-call-end-eyebrow">CALL ENDED · 상담 종료</div>
            <h2 className="y-call-end-title">연화와 4분 12초</h2>
            <div className="y-call-end-time">04:12 · 2026.04.26 SUN</div>
          </div>

          <div className="y-call-summary-section">
            <div className="y-call-summary-card">
              <div className="y-call-summary-head">
                <div className="y-call-summary-icon">心</div>
                <div className="y-call-summary-title">연화의 한 마디 요약</div>
              </div>
              <div className="y-call-summary-body">
                그 사람은 <strong>헤어진 후에도 마음을 닫지 못한 상태</strong>입니다. 다만 표현이 서툰 일주이니 먼저 다가가지 않을 가능성이 높아요.
                5월 중순부터 인연이 다시 닿을 자리가 보이니, 그 전까지는 <strong>차분히 자신을 돌보는 시간</strong>으로 쓰세요.
              </div>
            </div>

            <div className="y-call-summary-card">
              <div className="y-call-summary-head">
                <div className="y-call-summary-icon">道</div>
                <div className="y-call-summary-title">행동 가이드</div>
              </div>
              <div className="y-call-summary-body">
                · 4월 말까지는 먼저 연락하지 마세요
                <br />· 5월 중순 이후, 자연스러운 안부 정도가 적절합니다
                <br />· 만약 다시 만나게 되면 두 분의 속궁합은 좋습니다
              </div>
            </div>

            <div className="y-call-rating">
              <div className="y-call-rating-q">연화의 풀이는 어떠셨나요?</div>
              <div className="y-call-rating-stars" aria-label="별점">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button key={i} className="y-call-rating-star on" type="button" aria-label={`${i + 1}점`}>
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="y-call-end-foot">
            <button className="y-end-btn-secondary" type="button" onClick={() => (window.location.href = "/")}>
              홈으로
            </button>
            <button className="y-end-btn-primary" type="button" onClick={() => (window.location.href = "/content/reunion-maybe?modal=1")}>
              텍스트로 받아보기 · 14,900원
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="yeonunPage" style={{ background: "#1A1815" }}>
      <main className="y-call-root">
        <header className="y-call-header">
          <a className="y-call-back" href="/meet" aria-label="뒤로">
            <svg viewBox="0 0 24 24">
              <path d="M15 18 L9 12 L15 6" />
            </svg>
          </a>
          <div className="y-call-title">VOICE · LIVE</div>
          <div className="y-call-stats" />
        </header>

        <section className="y-call-stage" aria-label="통화 중">
          <div className="y-call-avatar-wrap">
            <div className="y-call-aura-1" />
            <div className="y-call-aura-2" />
            <div className="y-call-aura-3" />
            <div className="y-call-avatar">蓮</div>
          </div>

          <div className="y-call-name-block">
            <div className="y-call-spec">재회 · 연애 · 궁합</div>
            <div className="y-call-name">연화</div>
            <div className="y-call-status">
              연화가 말하고 있어요
              <span className="pulse-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>

          <div className="y-call-wave-dual" aria-label="듀얼 파형">
            <div className={`y-wave-line tts ${activeLine === "tts" ? "active" : ""}`} onClick={() => setActiveLine("tts")}>
              <div className="y-wave-tag">
                <span className="y-wave-dot tts" />
                <span className="y-wave-name">연화</span>
              </div>
              <div className="y-wave-bars">
                {bars.map((i) => (
                  <div key={`t${i}`} className="y-wave-bar tts" style={{ animationDelay: `${(i % 6) * 0.08}s` }} />
                ))}
              </div>
            </div>
            <div className={`y-wave-line stt ${activeLine === "stt" ? "active" : ""}`} onClick={() => setActiveLine("stt")}>
              <div className="y-wave-tag">
                <span className="y-wave-dot stt" />
                <span className="y-wave-name">나</span>
              </div>
              <div className="y-wave-bars">
                {bars.map((i) => (
                  <div key={`s${i}`} className="y-wave-bar stt" style={{ animationDelay: `${(i % 6) * 0.08}s` }} />
                ))}
              </div>
            </div>
          </div>

          <div className="y-call-caption" aria-label="자막">
            <div className="y-call-caption-head">내가 방금 한 말</div>
            <div className="y-call-caption-body">
              그 사람이 자꾸 떠올라요. 헤어진 지 두 달 됐는데, 다시 만날 수 있을까 너무 궁금해요.
            </div>
          </div>
        </section>

        <footer className="y-call-controls" aria-label="컨트롤">
          <div className="y-call-meter">
            <div>
              <div className="y-call-meter-time">02:34</div>
              <div className="y-call-meter-sub">상담 시간</div>
            </div>
            <div className="y-call-meter-info">
              <div className="y-call-meter-usage">
                무료 <span className="free">3분</span> 중 2:34 사용
              </div>
              <div className="y-call-meter-after">이후 분당 390원</div>
            </div>
          </div>

          <div className="y-call-mic" aria-label="마이크 민감도">
            <div className="y-call-mic-row">
              <span className="label">마이크 민감도</span>
              <span className="value">50%</span>
            </div>
            <div className="y-call-mic-track" role="presentation">
              <div className="y-call-mic-fill" style={{ width: "50%" }} />
              <div className="y-call-mic-thumb" style={{ left: "50%" }} />
            </div>
          </div>

          <div className="y-call-btns">
            <button className={`y-call-ctrl ${muted ? "muted" : ""}`} type="button" onClick={() => setMuted((v) => !v)}>
              <svg viewBox="0 0 24 24">
                <path d="M12 2 a4 4 0 0 1 4 4 v6 a4 4 0 0 1-8 0 V6 a4 4 0 0 1 4-4z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <path d="M12 19v3" />
              </svg>
            </button>
            <button className="y-call-end" type="button" onClick={() => setEnded(true)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
                <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
              </svg>
              상담 종료
            </button>
            <button className="y-call-ctrl" type="button" aria-label="스피커">
              <svg viewBox="0 0 24 24">
                <path d="M11 5L6 9H3v6h3l5 4V5z" />
                <path d="M16 8a4 4 0 0 1 0 8" />
                <path d="M18.5 5.5a7 7 0 0 1 0 13" />
              </svg>
            </button>
          </div>

          <div className="y-call-note">
            음성 응답이 1~2초 지연될 수 있어요 · 다른 작업(화면캡쳐·전화 등)은 하지 마세요
          </div>
        </footer>
      </main>
    </div>
  );
}

