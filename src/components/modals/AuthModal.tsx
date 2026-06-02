"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import { SocialLoginSection } from "@/components/auth/SocialLoginSection";
import { AuthLegalConsentRow } from "@/components/legal/AuthLegalConsentRow";
import { PrivacyDocContent, TermsDocContent } from "@/components/legal/LegalDocContent";
import { LegalInlineSheet } from "@/components/legal/LegalInlineSheet";
import { SajuConsentRow } from "@/components/legal/SajuConsentRow";
import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import { useModalControls } from "@/components/modals/useModalControls";
import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";
import { parseCreditTopupAfterAuth } from "@/lib/credit-topup-auth";
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

function stopSheetPointerBubble(e: MouseEvent) {
  e.stopPropagation();
}

export function AuthModal() {
  const { close } = useModalControls();
  const { session } = useYeonunAuth();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const isOnboard = sp.get("onboard") === "1";
  const modalAuth = sp.get("modal") === "auth";
  const onboardInitRef = useRef(false);

  const [step, setStep] = useState<AuthStep>(() => (isOnboard ? "birth" : "login"));
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [calendarType, setCalendarType] = useState<CalendarType>("solar");
  const [timeIdx, setTimeIdx] = useState(3);
  const [birthMinute, setBirthMinute] = useState("0");
  const [unknownTime, setUnknownTime] = useState(false);
  const [gender, setGender] = useState<"male" | "female">("female");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [legalConsentChecked, setLegalConsentChecked] = useState(false);
  const [sajuConsentChecked, setSajuConsentChecked] = useState(false);
  const [legalSheet, setLegalSheet] = useState<"terms" | "privacy" | null>(null);

  /** OAuth 직후 1회만 birth로 진입. isOnboard가 true인 동안 매번 setStep("birth")하면 스텝3에서 뒤로/완료가 먹통처럼 보임 */
  useEffect(() => {
    if (!isOnboard) {
      onboardInitRef.current = false;
      return;
    }
    if (onboardInitRef.current) return;
    onboardInitRef.current = true;
    setStep("birth");
  }, [isOnboard]);

  useEffect(() => {
    if (!isOnboard && modalAuth) setStep("login");
  }, [isOnboard, modalAuth]);

  const canBack = isOnboard ? step === "time" || step === "gender" : step !== "login";

  const handleBack = useCallback(() => {
    if (step === "gender") setStep("time");
    else if (step === "time") setStep("birth");
    else if (step === "birth" && !isOnboard) setStep("login");
  }, [step, isOnboard]);

  const progress = useMemo(() => {
    if (step === "birth") return ["current", "", ""] as const;
    if (step === "time") return ["done", "current", ""] as const;
    if (step === "gender") return ["done", "done", "current"] as const;
    return ["", "", ""] as const;
  }, [step]);

  const search = sp.toString();

  const finishAfterAuthRedirect = useCallback(() => {
    const query = new URLSearchParams(search);
    const after = query.get("after_auth") ?? "";
    const next = new URLSearchParams(search);
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

    const creditDest = parseCreditTopupAfterAuth(after);
    if (creditDest) {
      router.replace(creditDest, { scroll: false });
      return;
    }

    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, search]);

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

  const submitInFlightRef = useRef(false);

  const submitOnboarding = useCallback(async () => {
    if (submitInFlightRef.current) return;
    if (!validateBirth()) return;
    if (!sajuConsentChecked) {
      window.alert("사주 정보 수집·이용에 동의해 주세요.");
      return;
    }

    submitInFlightRef.current = true;
    setSubmitBusy(true);
    const { y, mo, d } = parseBirthInts();
    const branchKey = unknownTime ? null : TIME_TAB_BRANCH_KEYS[timeIdx];
    const minuteParsed = Math.min(59, Math.max(0, parseInt(birthMinute, 10) || 0));

    let token = session?.access_token ?? null;
    if (!token) {
      const sb = supabaseBrowser();
      token = sb ? (await sb.auth.getSession()).data.session?.access_token ?? null : null;
    }
    if (!token) {
      submitInFlightRef.current = false;
      setSubmitBusy(false);
      window.alert("세션이 없습니다. 다시 로그인해 주세요.");
      return;
    }

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
          ...(!unknownTime && branchKey != null ? { birth_minute: minuteParsed } : {}),
          birth_time_unknown: unknownTime,
          gender,
          complete_onboarding: true,
          saju_consent: true,
          terms_accepted: true,
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
          minute = String(minuteParsed);
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
      const msg = e instanceof Error ? e.message : "";
      if (msg === "underage_not_allowed") {
        window.alert("만 14세 미만은 서비스를 이용할 수 없습니다.");
      } else if (msg === "age_verification_required") {
        window.alert("생년월일을 입력해 만 14세 이상 여부를 확인해 주세요.");
      } else {
        window.alert("프로필 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      submitInFlightRef.current = false;
      setSubmitBusy(false);
    }
  }, [
    birthDay,
    birthMonth,
    birthMinute,
    birthYear,
    calendarType,
    displayName,
    finishAfterAuthRedirect,
    gender,
    sajuConsentChecked,
    session?.access_token,
    timeIdx,
    unknownTime,
  ]);

  const dismiss = useCallback(
    (e?: MouseEvent) => {
      e?.stopPropagation();
      if (isOnboard) return;
      close();
    },
    [close, isOnboard],
  );

  const handleClose = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (isOnboard && step === "gender") {
        void submitOnboarding();
        return;
      }
      dismiss(e);
    },
    [dismiss, isOnboard, step, submitOnboarding],
  );

  const onboardFoot =
    step === "birth" ? (
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
    ) : step === "time" ? (
      <div className="y-onboard-foot">
        <button className="y-onboard-next" type="button" onClick={() => setStep("gender")}>
          다음
        </button>
      </div>
    ) : step === "gender" ? (
      <div className="y-onboard-foot">
        <button className="y-onboard-next" type="button" disabled={submitBusy || !sajuConsentChecked} onClick={() => void submitOnboarding()}>
          {submitBusy ? "저장 중…" : "완료 · 연운 시작하기"}
        </button>
      </div>
    ) : null;

  if (legalSheet) {
    return (
      <LegalInlineSheet
        title={legalSheet === "terms" ? "이용약관" : "개인정보처리방침"}
        ariaLabel={legalSheet === "terms" ? "이용약관" : "개인정보처리방침"}
        onClose={() => setLegalSheet(null)}
      >
        {legalSheet === "terms" ? <TermsDocContent /> : <PrivacyDocContent />}
      </LegalInlineSheet>
    );
  }

  return (
    <YeonunSheetPortal>
      <div className="y-modal open y-auth-modal" role="dialog" aria-modal="true" aria-label="시작하기" onMouseDown={dismiss}>
        <div className="y-modal-sheet" onMouseDown={stopSheetPointerBubble} onClick={stopSheetPointerBubble}>
          <div className="y-modal-handle" />

          <div className="y-modal-head">
            <button
              className="y-modal-back"
              type="button"
              onClick={handleBack}
              style={{ visibility: canBack ? "visible" : "hidden" }}
              aria-label="뒤로"
            >
              <svg viewBox="0 0 24 24">
                <path d="M15 18 L9 12 L15 6" />
              </svg>
            </button>
            <div className="y-modal-title">시작하기</div>
            <button className="y-modal-close" type="button" onClick={handleClose} aria-label="닫기">
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

                <AuthLegalConsentRow
                  checked={legalConsentChecked}
                  onChange={setLegalConsentChecked}
                  onOpenTerms={() => setLegalSheet("terms")}
                  onOpenPrivacy={() => setLegalSheet("privacy")}
                />

                <SocialLoginSection oauthDisabled={!legalConsentChecked} />

                <div className="y-auth-email-spacer" aria-hidden="true" />
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

                  {!unknownTime ? (
                    <div className="y-input-row" style={{ marginBottom: 16 }}>
                      <div className="y-input-cell" style={{ flex: 1 }}>
                        <div className="y-input-cell-label">MIN · 분</div>
                        <select
                          value={birthMinute}
                          onChange={(e) => setBirthMinute(e.target.value)}
                          aria-label="출생 분"
                        >
                          {Array.from({ length: 60 }, (_, i) => i).map((mm) => (
                            <option key={mm} value={String(mm)}>
                              {String(mm).padStart(2, "0")}분
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : null}

                  <button className={`y-time-unknown ${unknownTime ? "checked" : ""}`} type="button" onClick={() => setUnknownTime((v) => !v)}>
                    <div className="y-time-unknown-check">{unknownTime ? "✓" : ""}</div>
                    <div>출생시간을 모릅니다 (시주 제외하고 풀이)</div>
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
                  <SajuConsentRow checked={sajuConsentChecked} onChange={setSajuConsentChecked} />
                </div>
              </>
            ) : null}
          </div>

          {onboardFoot}
        </div>
      </div>
    </YeonunSheetPortal>
  );
}
