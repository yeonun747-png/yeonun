"use client";

import { useMemo, useState } from "react";

import { setAuthStubLoggedIn } from "@/lib/auth-stub";

type Step = "login" | "birth" | "time" | "gender";

type TimeTab = { han: string; time: string };

const TIME_TABS: TimeTab[] = [
  { han: "子", time: "23-01시" },
  { han: "丑", time: "01-03시" },
  { han: "寅", time: "03-05시" },
  { han: "卯", time: "05-07시" },
  { han: "辰", time: "07-09시" },
  { han: "巳", time: "09-11시" },
  { han: "午", time: "11-13시" },
  { han: "未", time: "13-15시" },
  { han: "申", time: "15-17시" },
  { han: "酉", time: "17-19시" },
  { han: "戌", time: "19-21시" },
  { han: "亥", time: "21-23시" },
];

export default function AuthPage() {
  const [step, setStep] = useState<Step>("login");
  const [timeIdx, setTimeIdx] = useState(3);
  const [unknownTime, setUnknownTime] = useState(false);
  const [gender, setGender] = useState<"male" | "female">("female");

  const progress = useMemo(() => {
    if (step === "login") return { bars: [false, false, false], label: "" };
    if (step === "birth") return { bars: ["current", false, false], label: "STEP 1 / 3 · 생년월일" } as const;
    if (step === "time") return { bars: ["done", "current", false], label: "STEP 2 / 3 · 출생시간" } as const;
    return { bars: ["done", "done", "current"], label: "STEP 3 / 3 · 성별" } as const;
  }, [step]);

  function onSocialDevLogin() {
    setAuthStubLoggedIn();
    setStep("birth");
  }

  return (
    <div className="yeonunPage">
      <main>
        <div className="y-modal-head" style={{ position: "sticky", top: 0, background: "var(--y-bg)", zIndex: 5 }}>
          <button
            className="y-modal-back"
            type="button"
            onClick={() => setStep(step === "login" ? "login" : step === "birth" ? "login" : step === "time" ? "birth" : "time")}
            style={{ visibility: step === "login" ? "hidden" : "visible" }}
            aria-label="뒤로"
          >
            <svg viewBox="0 0 24 24">
              <path d="M15 18 L9 12 L15 6" />
            </svg>
          </button>
          <div className="y-modal-title">시작하기</div>
          <a className="y-modal-close" href="/" aria-label="닫기">
            ×
          </a>
        </div>

        {step === "login" ? (
          <>
            <div className="y-auth-hero">
              <div className="y-auth-mark">연운</div>
              <div className="y-auth-han">緣運</div>
              <div className="y-auth-tagline">Your destiny, in voice.</div>
              <div className="y-auth-sub">3초 만에 시작하기</div>
            </div>

            <div className="y-auth-social">
              <button className="y-social-btn kakao" type="button" onClick={onSocialDevLogin}>
                <span className="icon" aria-hidden="true">
                  K
                </span>
                카카오로 시작하기
                <span className="recommend">3초</span>
              </button>
              <button className="y-social-btn naver" type="button" onClick={onSocialDevLogin}>
                <span className="icon" aria-hidden="true">
                  N
                </span>
                네이버로 시작하기
              </button>
              <button className="y-social-btn google" type="button" onClick={onSocialDevLogin}>
                <span className="icon" aria-hidden="true">
                  G
                </span>
                Google로 시작하기
              </button>
            </div>

            <div className="y-auth-email-spacer" aria-hidden="true" />

            <div className="y-auth-terms">
              가입하시면 연운의 <a href="/legal/terms">이용약관</a>과
              <br />
              <a href="/legal/privacy">개인정보처리방침</a>에 동의하는 것으로 간주됩니다.
            </div>
          </>
        ) : (
          <>
            <div className="y-onboard-progress" aria-label="진행률">
              {progress.bars.map((b, i) => (
                <div
                  key={i}
                  className={`y-onboard-progress-bar ${b === "done" ? "done" : b === "current" ? "current" : ""}`}
                />
              ))}
            </div>

            {step === "birth" ? (
              <>
                <div className="y-onboard-step">
                  <div className="y-onboard-step-label">{progress.label}</div>
                  <h1 className="y-onboard-question">언제 태어나셨나요?</h1>
                  <p className="y-onboard-help">
                    양력 기준으로 입력해주세요.
                    <br />
                    음력만 알고 계셔도 자동으로 변환됩니다.
                  </p>

                  <div className="y-input-row">
                    <div className="y-input-cell">
                      <div className="y-input-cell-label">YEAR · 년</div>
                      <input type="text" placeholder="1992" maxLength={4} />
                    </div>
                    <div className="y-input-cell">
                      <div className="y-input-cell-label">MO · 월</div>
                      <input type="text" placeholder="07" maxLength={2} />
                    </div>
                    <div className="y-input-cell">
                      <div className="y-input-cell-label">DAY · 일</div>
                      <input type="text" placeholder="14" maxLength={2} />
                    </div>
                  </div>
                </div>

                <div className="y-onboard-foot">
                  <button className="y-onboard-next" type="button" onClick={() => setStep("time")}>
                    다음
                  </button>
                  <button className="y-onboard-skip" type="button" onClick={() => setStep("time")}>
                    나중에 입력하기
                  </button>
                </div>
              </>
            ) : null}

            {step === "time" ? (
              <>
                <div className="y-onboard-step">
                  <div className="y-onboard-step-label">{progress.label}</div>
                  <h1 className="y-onboard-question">몇 시쯤이었나요?</h1>
                  <p className="y-onboard-help">
                    정확하지 않아도 괜찮아요.
                    <br />
                    대략적인 시간대만 알아도 됩니다.
                  </p>

                  <div className="y-onboard-time-tabs">
                    {TIME_TABS.map((t, idx) => (
                      <button
                        key={t.han}
                        className={`y-onboard-time-tab ${idx === timeIdx ? "active" : ""}`}
                        type="button"
                        onClick={() => {
                          setUnknownTime(false);
                          setTimeIdx(idx);
                        }}
                      >
                        <div className="han">{t.han}</div>
                        <div className="time">{t.time}</div>
                      </button>
                    ))}
                  </div>

                  <button
                    className={`y-time-unknown ${unknownTime ? "checked" : ""}`}
                    type="button"
                    onClick={() => setUnknownTime((v) => !v)}
                  >
                    <div className="y-time-unknown-check">{unknownTime ? "✓" : ""}</div>
                    <div>출생시간을 모릅니다 (시주 제외하고 풀이)</div>
                  </button>
                </div>

                <div className="y-onboard-foot">
                  <button className="y-onboard-next" type="button" onClick={() => setStep("gender")}>
                    다음
                  </button>
                </div>
              </>
            ) : null}

            {step === "gender" ? (
              <>
                <div className="y-onboard-step">
                  <div className="y-onboard-step-label">{progress.label}</div>
                  <h1 className="y-onboard-question">사주 풀이를 위해 알려주세요</h1>
                  <p className="y-onboard-help">남녀에 따라 동일한 사주도 풀이가 달라집니다.</p>

                  <div className="y-onboard-gender-row">
                    <button
                      className={`y-gender-card ${gender === "male" ? "active" : ""}`}
                      type="button"
                      onClick={() => setGender("male")}
                    >
                      <div className="icon">乾</div>
                      <div className="label">남자</div>
                    </button>
                    <button
                      className={`y-gender-card ${gender === "female" ? "active" : ""}`}
                      type="button"
                      onClick={() => setGender("female")}
                    >
                      <div className="icon">坤</div>
                      <div className="label">여자</div>
                    </button>
                  </div>
                </div>

                <div className="y-onboard-foot">
                  <button className="y-onboard-next" type="button" onClick={() => (window.location.href = "/")}>
                    완료 · 연운 시작하기
                  </button>
                </div>
              </>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

