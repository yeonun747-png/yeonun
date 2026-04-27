"use client";

import { useState } from "react";

import { useModalControls } from "@/components/modals/useModalControls";

type CalendarMode = "yang" | "eum";

export function SajuModal() {
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

