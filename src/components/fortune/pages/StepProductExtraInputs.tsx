"use client";

import { useMemo, useState } from "react";

import type { FortuneExtraFieldDef } from "@/lib/fortune-product-extra-config";
import { getFortuneProductExtraConfig } from "@/lib/fortune-product-extra-config";
import { readFortuneExtraAnswers, writeFortuneExtraAnswers, type FortuneExtraAnswers } from "@/lib/fortune-extra-input-storage";

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

function DateYmdBlock({
  baseId,
  label,
  hint,
  valueY,
  valueM,
  valueD,
  onChange,
}: {
  baseId: string;
  label: string;
  hint?: string;
  valueY: string;
  valueM: string;
  valueD: string;
  onChange: (y: string, m: string, d: string) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1899 }, (_, i) => String(currentYear - i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const maxDay = daysInMonth(valueY, valueM);
  const days = Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, "0"));
  return (
    <div className="y-fortune-v2-extra-block">
      <div className="y-fortune-v2-label">{label}</div>
      {hint ? <p className="y-fortune-v2-extra-hint">{hint}</p> : null}
      <div className="y-fortune-v2-date-grid">
        <select
          id={`${baseId}-y`}
          value={valueY}
          onChange={(e) => onChange(e.target.value, valueM, "")}
          aria-label={`${label} 연`}
        >
          <option value="">년</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <select
          id={`${baseId}-m`}
          value={valueM}
          onChange={(e) => onChange(valueY, e.target.value, "")}
          aria-label={`${label} 월`}
        >
          <option value="">월</option>
          {months.map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </select>
        <select
          id={`${baseId}-d`}
          value={valueD}
          onChange={(e) => onChange(valueY, valueM, e.target.value)}
          aria-label={`${label} 일`}
          disabled={!valueM}
        >
          <option value="">일</option>
          {days.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function validateField(f: FortuneExtraFieldDef, v: string): string | null {
  const t = v.trim();
  if (f.required && !t) return `${f.label}을(를) 입력해 주세요.`;
  if (f.kind === "textarea" && f.minLen && f.minLen > 0 && t.length < f.minLen) {
    return `${f.label}은(는) 최소 ${f.minLen}자 이상 적어 주세요.`;
  }
  if (f.kind === "text" && f.required && !t) return `${f.label}을(를) 입력해 주세요.`;
  if (f.kind === "gender" && f.required && !t) return `${f.label}을(를) 선택해 주세요.`;
  if (f.kind === "choice" && f.required && !t) return `${f.label}을(를) 선택해 주세요.`;
  if (f.kind === "date_ymd" && f.required) {
    const parts = t.split("-");
    if (parts.length !== 3 || parts.some((p) => !p)) return `${f.label}의 연·월·일을 모두 선택해 주세요.`;
  }
  return null;
}

/** date_ymd 필드는 저장 시 YYYY-MM-DD 문자열로 합칩니다. */
function splitYmd(stored: string): { y: string; m: string; d: string } {
  const p = stored.split("-");
  return { y: p[0] ?? "", m: p[1] ?? "", d: p[2] ?? "" };
}

export function StepProductExtraInputs({
  productSlug,
  onBack,
  onContinue,
}: {
  productSlug: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  const cfg = useMemo(() => getFortuneProductExtraConfig(productSlug), [productSlug]);
  const [answers, setAnswers] = useState<FortuneExtraAnswers>(() => readFortuneExtraAnswers(productSlug));
  const [ymdParts, setYmdParts] = useState<Record<string, { y: string; m: string; d: string }>>(() => {
    const init: Record<string, { y: string; m: string; d: string }> = {};
    if (!cfg) return init;
    for (const f of cfg.fields) {
      if (f.kind === "date_ymd") init[f.id] = splitYmd(answers[f.id] ?? "");
    }
    return init;
  });
  const [error, setError] = useState<string | null>(null);

  if (!cfg) return null;

  function setAnswer(id: string, v: string) {
    setAnswers((prev) => ({ ...prev, [id]: v }));
  }

  function submit() {
    if (!cfg) return;
    const merged: FortuneExtraAnswers = { ...answers };
    for (const f of cfg.fields) {
      if (f.kind === "date_ymd") {
        const p = ymdParts[f.id] ?? { y: "", m: "", d: "" };
        merged[f.id] = p.y && p.m && p.d ? `${p.y}-${p.m}-${p.d}` : "";
      }
    }
    for (const f of cfg.fields) {
      const err = validateField(f, merged[f.id] ?? "");
      if (err) {
        setError(err);
        return;
      }
    }
    setError(null);
    writeFortuneExtraAnswers(productSlug, merged);
    onContinue();
  }

  return (
    <section className="y-fortune-v2-page y-fortune-v2-page--input y-fortune-v2-page--stack y-fortune-v2-page--product-extra">
      <div className="y-fortune-v2-section-head">
        <h1>{cfg.screenTitle}</h1>
        {cfg.screenHint ? <p>{cfg.screenHint}</p> : null}
      </div>

      {cfg.fields.map((f) => {
        if (f.kind === "textarea") {
          const rows = f.required && (f.minLen ?? 0) >= 30 ? 5 : 3;
          return (
            <div key={f.id} className="y-fortune-v2-extra-block">
              <div className="y-fortune-v2-label">
                {f.label}
                {f.required ? <span className="y-fortune-v2-extra-req"> · 필수</span> : null}
              </div>
              {f.hint ? <p className="y-fortune-v2-extra-hint">{f.hint}</p> : null}
              <div className="y-fortune-v2-textarea-shell">
                <textarea
                  className="y-fortune-v2-input y-fortune-v2-extra-textarea"
                  value={answers[f.id] ?? ""}
                  onChange={(e) => setAnswer(f.id, e.target.value)}
                  placeholder={f.placeholder}
                  rows={rows}
                  aria-label={f.label}
                />
              </div>
            </div>
          );
        }
        if (f.kind === "text") {
          return (
            <div key={f.id} className="y-fortune-v2-extra-block">
              <div className="y-fortune-v2-label">
                {f.label}
                {f.required ? <span className="y-fortune-v2-extra-req"> · 필수</span> : null}
              </div>
              {f.hint ? <p className="y-fortune-v2-extra-hint">{f.hint}</p> : null}
              <input
                className="y-fortune-v2-input"
                value={answers[f.id] ?? ""}
                onChange={(e) => setAnswer(f.id, e.target.value)}
                placeholder={f.placeholder}
                aria-label={f.label}
              />
            </div>
          );
        }
        if (f.kind === "gender") {
          const v = answers[f.id] ?? "";
          return (
            <div key={f.id} className="y-fortune-v2-extra-block">
              <div className="y-fortune-v2-label">
                {f.label}
                {f.required ? <span className="y-fortune-v2-extra-req"> · 필수</span> : null}
              </div>
              <div className="y-fortune-v2-toggle">
                <button type="button" className={v === "male" ? "active" : ""} onClick={() => setAnswer(f.id, "male")}>
                  남성
                </button>
                <button type="button" className={v === "female" ? "active" : ""} onClick={() => setAnswer(f.id, "female")}>
                  여성
                </button>
              </div>
            </div>
          );
        }
        if (f.kind === "choice" && f.options?.length) {
          const v = answers[f.id] ?? "";
          return (
            <div key={f.id} className="y-fortune-v2-extra-block">
              <div className="y-fortune-v2-label">
                {f.label}
                {f.required ? <span className="y-fortune-v2-extra-req"> · 필수</span> : null}
              </div>
              <div className="y-fortune-v2-toggle y-fortune-v2-toggle--wrap">
                {f.options.map((opt) => (
                  <button key={opt} type="button" className={v === opt ? "active" : ""} onClick={() => setAnswer(f.id, opt)}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        if (f.kind === "date_ymd") {
          const p = ymdParts[f.id] ?? { y: "", m: "", d: "" };
          return (
            <DateYmdBlock
              key={f.id}
              baseId={f.id}
              label={f.label}
              hint={f.hint}
              valueY={p.y}
              valueM={p.m}
              valueD={p.d}
              onChange={(y, m, d) => {
                setYmdParts((prev) => ({ ...prev, [f.id]: { y, m, d } }));
                if (y && m && d) setAnswer(f.id, `${y}-${m}-${d}`);
                else setAnswer(f.id, "");
              }}
            />
          );
        }
        return null;
      })}

      {error ? <p className="y-fortune-v2-pay-error">{error}</p> : null}

      <div className="y-fortune-v2-extra-actions">
        <button type="button" className="y-fortune-v2-outline" onClick={onBack}>
          ← 이전
        </button>
        <button type="button" className="y-fortune-v2-primary" onClick={submit}>
          다음으로 →
        </button>
      </div>
    </section>
  );
}
