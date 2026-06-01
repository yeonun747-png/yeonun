"use client";

import { SajuConsentRow } from "@/components/legal/SajuConsentRow";
import type { FortuneFlowForm } from "@/components/fortune/fortuneFlowTypes";

const CLOCK_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function daysInMonth(yearRaw: string, monthRaw: string) {
  const y = Number(yearRaw);
  const m = Number(monthRaw);
  if (!Number.isFinite(m) || m < 1 || m > 12) return 31;
  if (!Number.isFinite(y) || y < 1) {
    if (m === 2) return 29;
    if ([4, 6, 9, 11].includes(m)) return 30;
    return 31;
  }
  return new Date(y, m, 0).getDate();
}

export function Step1Input({
  form,
  onChange,
  onSubmit,
  showSajuConsent = false,
  sajuConsentChecked = false,
  onSajuConsentChange,
}: {
  form: FortuneFlowForm;
  onChange: (patch: Partial<FortuneFlowForm>) => void;
  onSubmit: () => void;
  showSajuConsent?: boolean;
  sajuConsentChecked?: boolean;
  onSajuConsentChange?: (checked: boolean) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1899 }, (_, i) => String(currentYear - i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const maxDay = daysInMonth(form.year, form.month);
  const days = Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, "0"));
  const hasHour = Boolean((form.hour ?? "").trim());

  return (
    <section className="y-fortune-v2-page y-fortune-v2-page--input y-fortune-v2-page--stack">
      <div className="y-fortune-v2-section-head">
        <h1>입력</h1>
        <p>정확하게 태어난 날과 시간을 알려주세요 · 자미두수 등은 분까지 맞추면 더 정확해요</p>
      </div>
      <input
        className="y-fortune-v2-input"
        value={form.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="이름을 입력하세요"
      />
      <div className="y-fortune-v2-label">양력 / 음력</div>
      <div className="y-fortune-v2-toggle">
        <button
          type="button"
          className={form.calendarType !== "solar" ? "" : "active"}
          onClick={() => onChange({ calendarType: "solar" })}
        >
          양력
        </button>
        <button
          type="button"
          className={form.calendarType === "solar" ? "" : "active"}
          onClick={() => onChange({ calendarType: "lunar" })}
        >
          음력
        </button>
      </div>
      <div className="y-fortune-v2-label">생년월일</div>
      <div className="y-fortune-v2-date-grid">
        <select value={form.year} onChange={(e) => onChange({ year: e.target.value, day: "" })} aria-label="생년">
          <option value="">년</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <select value={form.month} onChange={(e) => onChange({ month: e.target.value, day: "" })} aria-label="생월">
          <option value="">월</option>
          {months.map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </select>
        <select value={form.day} onChange={(e) => onChange({ day: e.target.value })} aria-label="생일" disabled={!form.month}>
          <option value="">일</option>
          {days.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
      </div>
      <div className="y-fortune-v2-label">출생 시·분</div>
      <div className="y-fortune-v2-date-grid y-fortune-v2-time-grid">
        <select
          className="y-fortune-v2-select"
          value={form.hour ?? ""}
          onChange={(e) => {
            const h = e.target.value;
            if (h === "") onChange({ hour: "", minute: "" });
            else onChange({ hour: h, minute: form.minute && form.minute.trim() !== "" ? form.minute : "00" });
          }}
          aria-label="출생 시 (24시간)"
        >
          <option value="">시 모름</option>
          {CLOCK_HOURS.map((h) => (
            <option key={h} value={h}>
              {h}시
            </option>
          ))}
        </select>
        <select
          className="y-fortune-v2-select"
          value={hasHour ? form.minute || "00" : ""}
          onChange={(e) => onChange({ minute: e.target.value })}
          aria-label="출생 분"
          disabled={!hasHour}
        >
          {!hasHour ? <option value="">분</option> : null}
          {hasHour
            ? MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m}분
                </option>
              ))
            : null}
        </select>
      </div>
      {showSajuConsent ? (
        <SajuConsentRow checked={sajuConsentChecked} onChange={(v) => onSajuConsentChange?.(v)} />
      ) : null}
      <button
        className="y-fortune-v2-primary"
        type="button"
        disabled={!form.year || !form.month || !form.day || (showSajuConsent && !sajuConsentChecked)}
        onClick={onSubmit}
      >
        풀이 시작하기 →
      </button>
    </section>
  );
}
