"use client";

import { useEffect, useMemo, useState } from "react";

import { useModalControls } from "@/components/modals/useModalControls";
import { __YEONUN_SAJU_STORAGE_KEY__ } from "@/components/my/MySajuCardClient";
import { dispatchMissionsReconcile } from "@/lib/mission-reconcile";

type CalendarMode = "yang" | "eum";

export function SajuModal() {
  const { close } = useModalControls();
  const [mode, setMode] = useState<CalendarMode>("yang");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [name, setName] = useState("");
  const [year, setYear] = useState("1992");
  const [month, setMonth] = useState("7");
  const [day, setDay] = useState("14");
  const [hour, setHour] = useState(""); // "" = 모름
  const [minute, setMinute] = useState("0");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(__YEONUN_SAJU_STORAGE_KEY__);
      if (!raw) return;
      const j = JSON.parse(raw) as {
        name?: string;
        calendarType?: string;
        year?: string;
        month?: string;
        day?: string;
        hour?: string;
        minute?: string;
        gender?: string;
      };
      const ct = String(j.calendarType ?? "solar");
      setMode(ct === "solar" ? "yang" : "eum");
      setGender(j.gender === "male" ? "male" : "female");
      setName(String(j.name ?? "").trim());

      const maxY = new Date().getFullYear();
      const yNum = parseInt(String(j.year ?? ""), 10);
      if (Number.isFinite(yNum) && yNum >= 1900 && yNum <= maxY) {
        setYear(String(yNum));
      }
      const mo = parseInt(String(j.month ?? ""), 10);
      if (Number.isFinite(mo) && mo >= 1 && mo <= 12) {
        setMonth(String(mo));
      }
      const dNum = parseInt(String(j.day ?? ""), 10);
      if (Number.isFinite(dNum) && dNum >= 1 && dNum <= 31) {
        setDay(String(dNum));
      }

      const hRaw = j.hour != null ? String(j.hour).trim() : "";
      const hNum = parseInt(hRaw, 10);
      if (hRaw !== "" && Number.isFinite(hNum) && hNum >= 0 && hNum <= 23) {
        setHour(String(hNum));
        const miRaw = j.minute != null ? String(j.minute).trim() : "0";
        const miNum = parseInt(miRaw, 10);
        if (Number.isFinite(miNum) && miNum >= 0 && miNum <= 59) {
          setMinute(String(miNum));
        } else {
          setMinute("0");
        }
      } else {
        setHour("");
        setMinute("0");
      }
    } catch {
      // 저장값이 깨졌으면 초기 기본값 유지
    }
  }, []);

  const yearOptions = useMemo(() => {
    const now = new Date();
    const max = now.getFullYear();
    const min = 1900;
    const out: number[] = [];
    for (let y = max; y >= min; y--) out.push(y);
    return out;
  }, []);

  const dayOptions = useMemo(() => {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return Array.from({ length: 31 }, (_, i) => i + 1);
    const last = new Date(y, m, 0).getDate();
    return Array.from({ length: last }, (_, i) => i + 1);
  }, [year, month]);

  function save() {
    try {
      const payload = {
        name: name.trim() || "",
        calendarType: mode === "yang" ? "solar" : "lunar",
        year,
        month,
        day,
        hour,
        minute,
        gender,
      };
      localStorage.setItem(__YEONUN_SAJU_STORAGE_KEY__, JSON.stringify(payload));
      // 같은 탭에서 /my 카드가 즉시 갱신되도록 커스텀 이벤트를 쏜다.
      window.dispatchEvent(new Event("yeonun:saju-updated"));
      dispatchMissionsReconcile();
    } catch {
      // ignore
    }
    close();
  }

  return (
    <div
      className="y-modal y-modal--saju open"
      role="dialog"
      aria-modal="true"
      aria-label="만세력·사주 입력"
      onMouseDown={close}
    >
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
              <input className="y-saju-input" placeholder="홍길동" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="y-saju-field">
              <div className="y-saju-label">생년월일 ({mode === "yang" ? "양력" : "음력"})</div>
              <div className="y-saju-grid-3">
                <select className="y-saju-input" value={year} onChange={(e) => setYear(e.target.value)} aria-label="출생 연도">
                  {yearOptions.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}년
                    </option>
                  ))}
                </select>
                <select className="y-saju-input" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="출생 월">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={String(m)}>
                      {String(m).padStart(2, "0")}월
                    </option>
                  ))}
                </select>
                <select className="y-saju-input" value={day} onChange={(e) => setDay(e.target.value)} aria-label="출생 일">
                  {dayOptions.map((d) => (
                    <option key={d} value={String(d)}>
                      {String(d).padStart(2, "0")}일
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="y-saju-field">
              <div className="y-saju-label">출생시간</div>
              <div className="y-saju-grid-2">
                <select className="y-saju-input" value={hour} onChange={(e) => setHour(e.target.value)} aria-label="출생 시">
                  <option value="">모름</option>
                  {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                    <option key={h} value={String(h)}>
                      {String(h).padStart(2, "0")}시
                    </option>
                  ))}
                </select>
                <select className="y-saju-input" value={minute} onChange={(e) => setMinute(e.target.value)} aria-label="출생 분" disabled={!hour}>
                  {Array.from({ length: 60 }, (_, i) => i).map((mm) => (
                    <option key={mm} value={String(mm)}>
                      {String(mm).padStart(2, "0")}분
                    </option>
                  ))}
                </select>
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

            <div className="y-saju-save-block">
              <div className="y-saju-save-spacer" aria-hidden />
              <button type="button" className="y-my-login-btn" style={{ width: "100%" }} onClick={save}>
                저장하고 계산하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

