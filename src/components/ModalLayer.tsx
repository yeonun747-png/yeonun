"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type AuthStep = "login" | "birth" | "time" | "gender";
type CalendarMode = "yang" | "eum";

const TIME_TABS = [
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

function useModalControls() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const close = () => {
    const next = new URLSearchParams(sp.toString());
    next.delete("modal");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return { close };
}

function AuthModal() {
  const { close } = useModalControls();
  const [step, setStep] = useState<AuthStep>("login");
  const [timeIdx, setTimeIdx] = useState(3);
  const [unknownTime, setUnknownTime] = useState(false);
  const [gender, setGender] = useState<"male" | "female">("female");

  useEffect(() => {
    setStep("login");
  }, []);

  const canBack = step !== "login";
  const back = () => setStep(step === "birth" ? "login" : step === "time" ? "birth" : "time");

  const progress = useMemo(() => {
    if (step === "birth") return ["current", "", ""] as const;
    if (step === "time") return ["done", "current", ""] as const;
    if (step === "gender") return ["done", "done", "current"] as const;
    return ["", "", ""] as const;
  }, [step]);

  return (
    <div className="y-modal open" role="dialog" aria-modal="true" aria-label="시작하기" onMouseDown={close}>
      <div className="y-modal-sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="y-modal-handle" />

        <div className="y-modal-head">
          <button className="y-modal-back" type="button" onClick={back} style={{ visibility: canBack ? "visible" : "hidden" }} aria-label="뒤로">
            <svg viewBox="0 0 24 24">
              <path d="M15 18 L9 12 L15 6" />
            </svg>
          </button>
          <div className="y-modal-title">시작하기</div>
          <button className="y-modal-close" type="button" onClick={close} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="y-modal-scroll">
          {step === "login" ? (
            <>
            <div className="y-auth-hero">
              <div className="y-auth-mark">연운</div>
              <div className="y-auth-han">緣運</div>
              <div className="y-auth-tagline">Your destiny, in voice.</div>
              <div className="y-auth-sub">3초 만에 시작하기</div>
            </div>

            <div className="y-auth-social">
              <button className="y-social-btn kakao" type="button" onClick={() => setStep("birth")}>
                <span className="icon" aria-hidden="true">
                  K
                </span>
                카카오로 시작하기
                <span className="recommend">3초</span>
              </button>
              <button className="y-social-btn naver" type="button" onClick={() => setStep("birth")}>
                <span className="icon" aria-hidden="true">
                  N
                </span>
                네이버로 시작하기
              </button>
              <button className="y-social-btn google" type="button" onClick={() => setStep("birth")}>
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
          ) : null}

          {step !== "login" ? (
            <>
            <div className="y-onboard-progress" aria-label="진행률">
              {progress.map((p, i) => (
                <div key={i} className={`y-onboard-progress-bar ${p === "done" ? "done" : p === "current" ? "current" : ""}`} />
              ))}
            </div>
            </>
          ) : null}

        {step === "birth" ? (
          <>
            <div className="y-onboard-step">
              <div className="y-onboard-step-label">STEP 1 / 3 · 생년월일</div>
              <h2 className="y-onboard-question">언제 태어나셨나요?</h2>
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
              <div className="y-onboard-step-label">STEP 2 / 3 · 출생시간</div>
              <h2 className="y-onboard-question">몇 시쯤이었나요?</h2>
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

              <button className={`y-time-unknown ${unknownTime ? "checked" : ""}`} type="button" onClick={() => setUnknownTime((v) => !v)}>
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
              <div className="y-onboard-step-label">STEP 3 / 3 · 성별</div>
              <h2 className="y-onboard-question">사주 풀이를 위해 알려주세요</h2>
              <p className="y-onboard-help">남녀에 따라 동일한 사주도 풀이가 달라집니다.</p>

              <div className="y-onboard-gender-row">
                <button className={`y-gender-card ${gender === "male" ? "active" : ""}`} type="button" onClick={() => setGender("male")}>
                  <div className="icon">乾</div>
                  <div className="label">남자</div>
                </button>
                <button className={`y-gender-card ${gender === "female" ? "active" : ""}`} type="button" onClick={() => setGender("female")}>
                  <div className="icon">坤</div>
                  <div className="label">여자</div>
                </button>
              </div>
            </div>
            <div className="y-onboard-foot">
              <button className="y-onboard-next" type="button" onClick={close}>
                완료 · 연운 시작하기
              </button>
            </div>
          </>
        ) : null}
        </div>
      </div>
    </div>
  );
}

function SajuModal() {
  const { close } = useModalControls();
  const [mode, setMode] = useState<CalendarMode>("yang");
  const [gender, setGender] = useState<"male" | "female">("female");

  return (
    <div className="y-modal open" role="dialog" aria-modal="true" aria-label="만세력·사주 입력" onMouseDown={close}>
      <div className="y-modal-sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="y-modal-handle" />

        <div className="y-modal-head">
          <button className="y-modal-back" type="button" onClick={close} aria-label="뒤로">
            <svg viewBox="0 0 24 24">
              <path d="M15 18 L9 12 L15 6" />
            </svg>
          </button>
          <div className="y-modal-title">만세력 · 사주 입력</div>
          <button className="y-modal-close" type="button" onClick={close} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="y-modal-scroll">
          <div style={{ padding: "14px 20px 0" }}>
            <div className="y-saju-seg" role="tablist" aria-label="양력/음력">
              <button
                className={`y-saju-seg-btn ${mode === "yang" ? "active" : ""}`}
                type="button"
                role="tab"
                aria-selected={mode === "yang"}
                onClick={() => setMode("yang")}
              >
                양력
              </button>
              <button
                className={`y-saju-seg-btn ${mode === "eum" ? "active" : ""}`}
                type="button"
                role="tab"
                aria-selected={mode === "eum"}
                onClick={() => setMode("eum")}
              >
                음력
              </button>
            </div>
          </div>

          <div style={{ padding: "12px 20px 24px" }}>
            <div className="y-saju-field">
              <div className="y-saju-label">이름 (선택)</div>
              <input className="y-saju-input" placeholder="홍길동" />
            </div>

          <div className="y-saju-field">
            <div className="y-saju-label">생년월일 ({mode === "yang" ? "양력" : "음력"})</div>
            <div className="y-saju-grid-3">
              <input className="y-saju-input" placeholder="1992 (년)" />
              <input className="y-saju-input" placeholder="07" />
              <input className="y-saju-input" placeholder="14" />
            </div>
          </div>

          <div className="y-saju-field">
            <div className="y-saju-label">출생시간</div>
            <div className="y-saju-grid-2">
              <input className="y-saju-input" placeholder="03 (시)" />
              <input className="y-saju-input" placeholder="25 (분)" />
            </div>
          </div>

          <div className="y-saju-field">
            <div className="y-saju-label">성별</div>
            <div className="y-saju-gender">
              <button
                type="button"
                className={`y-saju-gender-card ${gender === "male" ? "active" : ""}`}
                onClick={() => setGender("male")}
              >
                <div className="han">乾</div>
                <div className="txt">남자</div>
              </button>
              <button
                type="button"
                className={`y-saju-gender-card ${gender === "female" ? "active" : ""}`}
                onClick={() => setGender("female")}
              >
                <div className="han">坤</div>
                <div className="txt">여자</div>
              </button>
            </div>
          </div>

          <div className="y-saju-field">
            <div className="y-saju-label">출생 지역 (선택)</div>
            <input className="y-saju-input" placeholder="서울특별시" />
          </div>

            <div className="y-saju-hint">
              진태양시 보정이 자동 적용됩니다. 출생 지역의 경도를 반영해 정확한 사주 명식을 계산합니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentModal() {
  const { close } = useModalControls();
  const sp = useSearchParams();
  const title = sp.get("title") ?? "그 사람과 다시 만날 수 있을까";
  const price = Number(sp.get("price") ?? "14900");

  const [method, setMethod] = useState<"card" | "phone" | "coin">("card");

  const payLabel = `${price.toLocaleString("ko-KR")}원 결제하기`;

  return (
    <div className="y-modal open" role="dialog" aria-modal="true" aria-label="결제하기" onMouseDown={close}>
      <div className="y-modal-sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="y-modal-handle" />
        <div className="y-modal-head">
          <button className="y-modal-back" type="button" onClick={close} aria-label="뒤로">
            <svg viewBox="0 0 24 24">
              <path d="M15 18 L9 12 L15 6" />
            </svg>
          </button>
          <div className="y-modal-title">결제하기</div>
          <button className="y-modal-close" type="button" onClick={close} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="y-modal-scroll">
          <div className="y-pay-section">
            <h3 className="y-pay-section-title">주문 상품</h3>
            <div className="y-pay-product">
              <div className="y-pay-product-cover" aria-hidden="true">
                緣
              </div>
              <div className="y-pay-product-text">
                <div className="y-pay-product-title">{title}</div>
                <div className="y-pay-product-by">연운의 풀이 · 약 30~60쪽</div>
              </div>
              <div className="y-pay-product-price">{price.toLocaleString("ko-KR")}원</div>
            </div>
          </div>

        <div className="y-pay-section">
          <h3 className="y-pay-section-title">결제 수단</h3>
        </div>
        <div className="y-pay-methods" role="radiogroup" aria-label="결제 수단">
          <div className={`y-pay-method ${method === "card" ? "active" : ""}`} role="radio" aria-checked={method === "card"} tabIndex={0} onClick={() => setMethod("card")}>
            <div className="y-pay-method-radio" />
            <div className="y-pay-method-name">신용·체크카드</div>
            <span className="y-pay-method-icon card">CARD</span>
          </div>
          <div className={`y-pay-method ${method === "phone" ? "active" : ""}`} role="radio" aria-checked={method === "phone"} tabIndex={0} onClick={() => setMethod("phone")}>
            <div className="y-pay-method-radio" />
            <div className="y-pay-method-name">휴대폰 결제</div>
            <span className="y-pay-method-icon phone">PHONE</span>
          </div>
          <div className={`y-pay-method ${method === "coin" ? "active" : ""}`} role="radio" aria-checked={method === "coin"} tabIndex={0} onClick={() => setMethod("coin")}>
            <div className="y-pay-method-radio" />
            <div className="y-pay-method-name">코인 결제</div>
            <span className="y-pay-method-icon coin">FORTUNE82</span>
          </div>
        </div>

        <div className="y-pay-summary">
          <div className="y-pay-row">
            <span className="label">상품 금액</span>
            <span className="value">{price.toLocaleString("ko-KR")}원</span>
          </div>
          <div className="y-pay-row discount">
            <span className="label">첫 구매 할인</span>
            <span className="value">-0원</span>
          </div>
          <div className="y-pay-total">
            <div className="y-pay-total-label">최종 결제 금액</div>
            <div className="y-pay-total-value">
              {price.toLocaleString("ko-KR")}
              <span className="small">원</span>
            </div>
          </div>
        </div>

        <div className="y-pay-terms">
          <div className="y-pay-terms-row checked">
            <div className="y-pay-terms-check">✓</div>
            <div className="text">
              <strong style={{ color: "var(--y-ink)" }}>전체 동의</strong>
            </div>
          </div>
          <div className="y-pay-terms-row checked">
            <div className="y-pay-terms-check">✓</div>
            <div className="text">
              [필수] <a href="/legal/terms">결제 약관</a> 동의
            </div>
          </div>
          <div className="y-pay-terms-row checked">
            <div className="y-pay-terms-check">✓</div>
            <div className="text">
              [필수] <a href="/legal/terms">전자상거래 약관</a> 동의
            </div>
          </div>
        </div>

          <div className="y-pay-foot">
            <button className="y-pay-pay-btn" type="button" onClick={close}>
              {payLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModalLayer() {
  const sp = useSearchParams();
  const modal = sp.get("modal");
  if (modal === "auth") return <AuthModal />;
  if (modal === "saju") return <SajuModal />;
  if (modal === "payment") return <PaymentModal />;
  return null;
}

