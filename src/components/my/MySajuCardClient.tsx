"use client";

import { useEffect, useMemo, useState } from "react";

import {
  computeManseFromFormInput,
  elementClassFromGan,
  toHanjaGan,
  toHanjaJi,
  type CalendarType,
} from "@/lib/manse-ryeok";

type StoredSaju = {
  name?: string;
  calendarType: CalendarType;
  year: string;
  month: string;
  day: string;
  hour: string; // 0-23 or ""(unknown)
  minute: string; // 0-59
  gender: "male" | "female";
};

const STORAGE_KEY = "yeonun_saju_v1";

function pad2(v: string | number) {
  const s = String(v);
  return s.length >= 2 ? s : `0${s}`;
}

function genderLabel(g: "male" | "female") {
  return g === "male" ? "남" : "여";
}

export function MySajuCardClient() {
  const [saved, setSaved] = useState<StoredSaju | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const j = JSON.parse(raw) as StoredSaju;
      if (!j?.year || !j?.month || !j?.day) return;
      setSaved(j);
    } catch {
      // ignore
    }
  }, []);

  const computed = useMemo(() => {
    if (!saved) return null;
    const r = computeManseFromFormInput({
      userYear: saved.year,
      userMonth: saved.month,
      userDay: saved.day,
      userBirthHour: saved.hour || null,
      userBirthMinute: saved.minute || null,
      userCalendarType: saved.calendarType,
      userName: saved.name || "",
    });
    return r;
  }, [saved]);

  if (!saved || !computed) {
    return (
      <div className="y-my-saju-card">
        <div className="y-my-saju-head">
          <div className="y-my-saju-title-block">
            <div className="y-my-saju-icon">命</div>
            <div>
              <div className="y-my-saju-title">내 사주 명식</div>
              <div className="y-my-saju-sub">아직 입력되지 않았습니다</div>
            </div>
          </div>
          <a className="y-my-saju-edit" href="/my?modal=saju">
            입력 ›
          </a>
        </div>
      </div>
    );
  }

  const { manse } = computed;
  const sub = `${saved.year}. ${pad2(saved.month)}. ${pad2(saved.day)}. ${saved.hour ? `${pad2(saved.hour)}:${pad2(saved.minute || "00")}` : "시간 모름"} · ${genderLabel(saved.gender)}`;

  const pillars = [
    { label: "시", gan: manse.hour.gan, ji: manse.hour.ji },
    { label: "일", gan: manse.day.gan, ji: manse.day.ji },
    { label: "월", gan: manse.month.gan, ji: manse.month.ji },
    { label: "년", gan: manse.year.gan, ji: manse.year.ji },
  ] as const;

  return (
    <div className="y-my-saju-card">
      <div className="y-my-saju-head">
        <div className="y-my-saju-title-block">
          <div className="y-my-saju-icon">命</div>
          <div>
            <div className="y-my-saju-title">내 사주 명식</div>
            <div className="y-my-saju-sub">{sub}</div>
          </div>
        </div>
        <a className="y-my-saju-edit" href="/my?modal=saju">
          수정 ›
        </a>
      </div>

      <div className="y-my-pillars" aria-label="사주 기둥">
        {pillars.map((p) => (
          <div key={p.label} className="y-my-pillar">
            <div className="y-my-p-label">{p.label}</div>
            <div className={`y-my-p-cheon ${elementClassFromGan(p.gan)}`}>{toHanjaGan(p.gan)}</div>
            <div className="y-my-p-ji">{toHanjaJi(p.ji)}</div>
          </div>
        ))}
      </div>

      <div className="y-my-saju-summary" aria-label="요약">
        <div className="y-my-summary-item">
          <div className="y-my-summary-label">일주</div>
          <div className="y-my-summary-value">
            <strong>
              {manse.day.gan}
              {manse.day.ji} ({toHanjaGan(manse.day.gan)}
              {toHanjaJi(manse.day.ji)})
            </strong>
          </div>
        </div>
        <div className="y-my-summary-item">
          <div className="y-my-summary-label">십성(일간 기준)</div>
          <div className="y-my-summary-value">
            <strong>{manse.month.sibsung}</strong> · 월간
          </div>
        </div>
      </div>
    </div>
  );
}

export const __YEONUN_SAJU_STORAGE_KEY__ = STORAGE_KEY;

