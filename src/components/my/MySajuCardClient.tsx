"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

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
  hour: string;
  minute: string;
  gender: "male" | "female";
};

const STORAGE_KEY = "yeonun_saju_v1";
const SAJU_UPDATED_EVENT = "yeonun:saju-updated";

function pad2(v: string | number) {
  const s = String(v);
  return s.length >= 2 ? s : `0${s}`;
}

function genderLabel(g: "male" | "female") {
  return g === "male" ? "남" : "여";
}

/** localStorage에서 명식 동기 읽기(서버에서는 항상 null) */
function readStoredSajuSync(): StoredSaju | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<StoredSaju>;
    if (!j?.year || !j?.month || !j?.day) return null;
    const calendarType: CalendarType =
      j.calendarType === "lunar" || j.calendarType === "lunar-leap" ? j.calendarType : "solar";
    const row: StoredSaju = {
      name: j.name,
      calendarType,
      year: String(j.year),
      month: String(j.month),
      day: String(j.day),
      hour: j.hour != null ? String(j.hour) : "",
      minute: j.minute != null ? String(j.minute) : "0",
      gender: j.gender === "male" ? "male" : "female",
    };
    const r = computeManseFromFormInput({
      userYear: row.year,
      userMonth: row.month,
      userDay: row.day,
      userBirthHour: row.hour || null,
      userBirthMinute: row.minute || null,
      userCalendarType: row.calendarType,
      userName: String(row.name || ""),
    });
    return r ? row : null;
  } catch {
    return null;
  }
}

function sameStored(a: StoredSaju | null, b: StoredSaju | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.calendarType === b.calendarType &&
    a.gender === b.gender &&
    String(a.name ?? "") === String(b.name ?? "")
  );
}

export function MySajuCardClient() {
  /** 서버와 하이드 1차는 null로 맞춤. 같은 틱에서 useLayoutEffect로 LS 복원해 첫 페인트에 실데이터 */
  const [saved, setSaved] = useState<StoredSaju | null>(null);

  const loadFromStorage = () => {
    setSaved((prev) => {
      const next = readStoredSajuSync();
      if (sameStored(prev, next)) return prev;
      return next;
    });
  };

  useLayoutEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    const onCustom = () => {
      loadFromStorage();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) loadFromStorage();
    };
    window.addEventListener(SAJU_UPDATED_EVENT, onCustom as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SAJU_UPDATED_EVENT, onCustom as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const computed = useMemo(() => {
    if (!saved) return null;
    return computeManseFromFormInput({
      userYear: saved.year,
      userMonth: saved.month,
      userDay: saved.day,
      userBirthHour: saved.hour || null,
      userBirthMinute: saved.minute || null,
      userCalendarType: saved.calendarType,
      userName: saved.name || "",
    });
  }, [saved]);

  const manse = computed?.manse ?? null;
  const hasData = !!(saved && computed && manse);

  const sub = hasData
    ? `${saved!.year}. ${pad2(saved!.month)}. ${pad2(saved!.day)}. ${saved!.hour ? `${pad2(saved!.hour)}:${pad2(saved!.minute || "00")}` : "시간 모름"} · ${genderLabel(saved!.gender)}`
    : "아직 입력되지 않았습니다";

  const pillarsCfg = [
    { label: "시" as const, gan: manse?.hour.gan, ji: manse?.hour.ji },
    { label: "일" as const, gan: manse?.day.gan, ji: manse?.day.ji },
    { label: "월" as const, gan: manse?.month.gan, ji: manse?.month.ji },
    { label: "년" as const, gan: manse?.year.gan, ji: manse?.year.ji },
  ];

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
        <Link className="y-my-saju-edit" href="/my?modal=saju" scroll={false}>
          {hasData ? "수정 ›" : "입력 ›"}
        </Link>
      </div>

      <div className="y-my-pillars" aria-label="사주 기둥">
        {pillarsCfg.map((p) => (
          <div key={p.label} className="y-my-pillar">
            <div className="y-my-p-label">{p.label}</div>
            <div
              className={
                p.gan ? `y-my-p-cheon ${elementClassFromGan(p.gan)}` : "y-my-p-cheon y-my-p-cheon--placeholder"
              }
            >
              {p.gan ? toHanjaGan(p.gan) : "—"}
            </div>
            <div className={p.ji ? "y-my-p-ji" : "y-my-p-ji y-my-p-ji--placeholder"}>{p.ji ? toHanjaJi(p.ji) : "—"}</div>
          </div>
        ))}
      </div>

      <div className="y-my-saju-summary" aria-label="요약">
        <div className="y-my-summary-item">
          <div className="y-my-summary-label">일주</div>
          <div className="y-my-summary-value">
            {hasData ? (
              <strong>
                {manse!.day.gan}
                {manse!.day.ji} ({toHanjaGan(manse!.day.gan)}
                {toHanjaJi(manse!.day.ji)})
              </strong>
            ) : (
              <strong className="y-my-summary-placeholder">—</strong>
            )}
          </div>
        </div>
        <div className="y-my-summary-item">
          <div className="y-my-summary-label">십성(일간 기준)</div>
          <div className="y-my-summary-value">
            {hasData ? (
              <strong>
                {manse!.month.sibsung} · 월간
              </strong>
            ) : (
              <strong className="y-my-summary-placeholder">—</strong>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const __YEONUN_SAJU_STORAGE_KEY__ = STORAGE_KEY;
