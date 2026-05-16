"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";

import { SocialLoginSection } from "@/components/auth/SocialLoginSection";
import { useModalControls } from "@/components/modals/useModalControls";
import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";
import { persistYeonunSajuV1 } from "@/lib/fortune-ux/sajuStorage";
import { TIME_TAB_BRANCH_KEYS } from "@/lib/profile-branch-from-time-tab";
import { YEONUN_SAJU_UPDATED_EVENT } from "@/lib/saju-events";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { CalendarType } from "@/lib/manse-ryeok";
import { PARTNER_HOUR_BRANCH_TO_CLOCK_HOUR } from "@/lib/partner-hour-branch";

type AuthStep = "login" | "birth" | "time" | "gender";

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

export function AuthModal() {
  const { close } = useModalControls();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const isOnboard = sp.get("onboard") === "1";
  const modalAuth = sp.get("modal") === "auth";

  const [step, setStep] = useState<AuthStep>(() => (isOnboard ? "birth" : "login"));
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [calendarType, setCalendarType] = useState<CalendarType>("solar");
  const [timeIdx, setTimeIdx] = useState(3);
  const [unknownTime, setUnknownTime] = useState(false);
  const [gender, setGender] = useState<"male" | "female">("female");
  const [submitBusy, setSubmitBusy] = useState(false);

  /** onboard 쿼리는 OAuth 직후에만 유지됨. sp 객체 전체를 deps에 넣으면 매 렌더마다 step이 birth로 리셋되어 다음/뒤로가 동작하지 않음 */
  useEffect(() => {
    if (isOnboard) setStep("birth");
  }, [isOnboard]);

  useEffect(() => {
    if (!isOnboard && modalAuth) setStep("login");
  }, [isOnboard, modalAuth]);

  const canBack = step !== "login";
  const back = () => setStep(step === "birth" ? "login" : step === "time" ? "birth" : "time");

  const dismiss = useCallback(
    (e?: MouseEvent) => {
      e?.stopPropagation();
      close();
    },
    [close],
  );

  const progress = useMemo(() => {
    if (step === "birth") return ["current", "", ""] as const;
    if (step === "time") return ["done", "current", ""] as const;
    if (step === "gender") return ["done", "done", "current"] as const;
    return ["", "", ""] as const;
  }, [step]);

  const finishAfterAuthRedirect = () => {
    const after = sp.get("after_auth") ?? "";
    const next = new URLSearchParams(sp.toString());
    next.delete("modal");
    next.delete("after_auth");
    next.delete("onboard");

    if (after.startsWith("chat:")) {
      const ck = after.slice(5);
      next.set("modal", "chat_consult");
      next.set("character_key", ck);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      return;
    }

    if (after.startsWith("call:")) {
      const ck = after.slice(5);
      router.replace(`/call-dcc?character_key=${encodeURIComponent(ck)}`);
      return;
    }

    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const parseBirthInts = () => {
    const y = parseInt(birthYear.trim(), 10);
    const mo = parseInt(birthMonth.trim(), 10);
    const d = parseInt(birthDay.trim(), 10);
    return { y, mo, d };
  };

  const validateBirth = (): boolean => {
    const nameOk = displayName.trim().length >= 1;
    const { y, mo, d } = parseBirthInts();
    if (!nameOk || !Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
      window.alert("이름과 생년월일을 입력해 주세요.");
      return false;
    }
    if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) {
      window.alert("생년월일 형식을 확인해 주세요.");
      return false;
    }
    return true;
  };

  const submitOnboarding = async () => {
    if (submitBusy) return;
    const { y, mo, d } = parseBirthInts();
    const branchKey = unknownTime ? null : TIME_TAB_BRANCH_KEYS[timeIdx];
    const sb = supabaseBrowser();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    if (!token) {
      window.alert("세션이 없습니다. 다시 로그인해 주세요.");
      return;
    }

    setSubmitBusy(true);
    try {
      const res = await fetch("/api/me/profile", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          birth_year: y,
          birth_month: mo,
          birth_day: d,
          calendar_type: calendarType,
          birth_branch_key: branchKey,
          birth_time_unknown: unknownTime,
          gender,
          complete_onboarding: true,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "profile_save_failed");
      }

      let hour = "";
      let minute = "";
      if (!unknownTime && branchKey) {
        const h = PARTNER_HOUR_BRANCH_TO_CLOCK_HOUR[branchKey];
        if (typeof h === "number") {
          hour = String(h);
          minute = "0";
        }
      }

      persistYeonunSajuV1({
        name: displayName.trim(),
        calendarType,
        year: String(y),
        month: String(mo),
        day: String(d),
        hour,
        minute,
        gender,
      });

      try {
        window.dispatchEvent(new Event(YEONUN_SAJU_UPDATED_EVENT));
      } catch {
        /* ignore */
      }

      finishAfterAuthRedirect();
    } catch (e) {
      console.error(e);
      window.alert("프로필 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitBusy(false);
    }
  };

  return (
    <YeonunSheetPortal>
      <div className="y-modal open y-auth-modal" role="dialog" aria-modal="true" aria-label="시작하기" onMouseDown={dismiss}>
        <div className="y-modal-sheet" onMouseDown={(e) => e.stopPropagation()}>
          <div className="y-modal-handle" />

          <div className="y-modal-head">
            <button className="y-modal-back" type="button" onClick={back} style={{ visibility: canBack ? "visible" : "hidden" }} aria-label="뒤로">
              <svg viewBox="0 0 24 24">
                <path d="M15 18 L9 12 L15 6" />
              </svg>
            </button>
            <div className="y-modal-title">시작하기</div>
            <button className="y-modal-close" type="button" onClick={dismiss} aria-label="닫기">
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

                <SocialLoginSection />

                <div className="y-auth-email-spacer" aria-hidden="true" />

                <div className="y-auth-terms">
                  가입하시면 연운의 <a href="/legal/terms">이용약관</a>과
                  <br />
                  <a href="/legal/privacy">개인정보처리방침</a>에 동의하는 것으로 간주됩니다.
                </div>
              </>
            ) : null}

            {step !== "login" ? (
              <div className="y-onboard-progress" aria-label="진행률">
                {progress.map((p, i) => (
                  <div key={i} className={`y-onboard-progress-bar ${p === "done" ? "done" : p === "current" ? "current" : ""}`} />
                ))}
              </div>
            ) : null}

            {step === "birth" ? (
              <>
                <div className="y-onboard-step">
                  <div className="y-onboard-step-label">STEP 1 / 3 · 이름 · 생년월일</div>
                  <h2 className="y-onboard-question">먼저 기본 정보를 알려주세요</h2>
                  <p className="y-onboard-help">표시 이름과 생년월일(양력 또는 음력)은 필수입니다.</p>

                  <div className="y-input-row" style={{ marginBottom: 14 }}>
                    <div className="y-input-cell" style={{ flex: 1 }}>
                      <div className="y-input-cell-label">NAME · 이름</div>
                      <input
                        type="text"
                        placeholder="홍길동"
                        maxLength={40}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  <div className="y-calendar-toggle" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <button
                      type="button"
                      className={`y-onboard-time-tab ${calendarType === "solar" ? "active" : ""}`}
                      onClick={() => setCalendarType("solar")}
                      style={{ flex: 1 }}
                    >
                      양력
                    </button>
                    <button
                      type="button"
                      className={`y-onboard-time-tab ${calendarType === "lunar" ? "active" : ""}`}
                      onClick={() => setCalendarType("lunar")}
                      style={{ flex: 1 }}
                    >
                      음력
                    </button>
                  </div>

                  <div className="y-input-row">
                    <div className="y-input-cell">
                      <div className="y-input-cell-label">YEAR · 년</div>
                      <input type="text" placeholder="1992" maxLength={4} value={birthYear} onChange={(e) => setBirthYear(e.target.value)} inputMode="numeric" />
                    </div>
                    <div className="y-input-cell">
                      <div className="y-input-cell-label">MO · 월</div>
                      <input type="text" placeholder="07" maxLength={2} value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} inputMode="numeric" />
                    </div>
                    <div className="y-input-cell">
                      <div className="y-input-cell-label">DAY · 일</div>
                      <input type="text" placeholder="14" maxLength={2} value={birthDay} onChange={(e) => setBirthDay(e.target.value)} inputMode="numeric" />
                    </div>
                  </div>
                </div>
                <div className="y-onboard-foot">
                  <button
                    className="y-onboard-next"
                    type="button"
                    onClick={() => {
                      if (!validateBirth()) return;
                      setStep("time");
                    }}
                  >
                    다음
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
                  <button className="y-onboard-next" type="button" disabled={submitBusy} onClick={() => void submitOnboarding()}>
                    {submitBusy ? "저장 중…" : "완료 · 연운 시작하기"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </YeonunSheetPortal>
  );
}
