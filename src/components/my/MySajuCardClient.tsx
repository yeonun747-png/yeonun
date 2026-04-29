"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import {
  branchEumyangHangul,
  computeManseFromFormInput,
  elementClassFromGan,
  elementClassFromStemOrBranch,
  getCurrentDaewoonPillar,
  getJijangganForJi,
  ohangHangulFromStemOrBranch,
  stemEumyangHangul,
  toHanjaGan,
  toHanjaJi,
  type CalendarType,
  type MansePillar,
  type ManseRyeokData,
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

function formatHangulHanjaGan(gan: string) {
  return `${gan}(${toHanjaGan(gan)})`;
}

function formatHangulHanjaJi(ji: string) {
  return `${ji}(${toHanjaJi(ji)})`;
}

function formatIljuHangulHanja(gan: string, ji: string) {
  return `${gan}${ji} (${toHanjaGan(gan)}${toHanjaJi(ji)})`;
}

/** 오행 한자 (화면 표기용) */
const OH_HANJA: Record<string, string> = { 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" };

const SIBSUNG_HANJA: Record<string, string> = {
  비견: "比肩",
  겁재: "劫財",
  식신: "食神",
  상관: "傷官",
  편재: "偏財",
  정재: "正財",
  편관: "偏官",
  정관: "正官",
  편인: "偏印",
  정인: "正印",
};

const SIBIUNSUNG_HANJA: Record<string, string> = {
  장생: "長生",
  목욕: "沐浴",
  관대: "冠帶",
  건록: "建祿",
  제왕: "帝旺",
  쇠: "衰",
  병: "病",
  사: "死",
  묘: "墓",
  절: "絕",
  태: "胎",
  양: "養",
};

const SINSAL_HANJA: Record<string, string> = {
  지살: "地殺",
  도화: "桃花",
  월살: "月殺",
  망신: "亡神",
  장성: "將星",
  반안: "攀鞍",
  역마: "驛馬",
  육해: "六害",
  화개: "華蓋",
  겁살: "劫殺",
  재살: "災殺",
  천살: "天殺",
};

const JI_ORDER = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"] as const;
/** 시지(두 시간 구간) 시작 시각 */
const JI_START_HOUR = [23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];

function branchTimeWindow(jiHangul: string): string {
  const idx = JI_ORDER.indexOf(jiHangul as (typeof JI_ORDER)[number]);
  if (idx < 0) return "";
  const sh = JI_START_HOUR[idx];
  const eh = (sh + 2) % 24;
  return `${pad2(sh)}:00 ~ ${pad2(eh)}:00`;
}

function hanjaOrKo(map: Record<string, string>, ko: string) {
  return map[ko] ?? ko;
}

function formatSinsalHangulHanja(name: string) {
  return `${name}(${hanjaOrKo(SINSAL_HANJA, name)})`;
}

function ManseTwoLineCell({
  lineKo,
  lineHj,
  elemClass,
}: {
  lineKo: string;
  lineHj: string;
  elemClass?: "wood" | "fire" | "earth" | "metal" | "water";
}) {
  const ec = elemClass ? ` y-manse-elem-${elemClass}` : "";
  return (
    <div className={`y-manse-cell${ec}`}>
      <div className="y-manse-cell-ko">{lineKo}</div>
      <div className="y-manse-cell-hj">({lineHj})</div>
    </div>
  );
}

function GubunTh({ main, sub }: { main: string; sub?: string }) {
  return (
    <th scope="row" className="y-manse-gubun">
      <span className="y-manse-gubun-main">{main}</span>
      {sub ? <span className="y-manse-gubun-sub">{sub}</span> : null}
    </th>
  );
}

function formatJijangganLines(ji: string): { ko: string; hj: string } {
  const stems = getJijangganForJi(ji);
  if (!stems.length) return { ko: "—", hj: "—" };
  const ko = stems.join("·");
  const hj = stems.map((s) => toHanjaGan(s)).join("·");
  return { ko, hj };
}

const MANSE_COLS: { key: keyof ManseRyeokData; label: string }[] = [
  { key: "hour", label: "시주" },
  { key: "day", label: "일주" },
  { key: "month", label: "월주" },
  { key: "year", label: "연주" },
];

function manseColCells(manse: ManseRyeokData, render: (p: MansePillar) => ReactNode): ReactNode {
  return MANSE_COLS.map(({ key }) => <td key={key}>{render(manse[key])}</td>);
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
  const [mounted, setMounted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

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
    setMounted(true);
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

  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [sheetOpen]);

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

  const birthYearNum = saved ? parseInt(saved.year, 10) : NaN;
  const daewoonSummary =
    hasData && manse && Number.isFinite(birthYearNum)
      ? getCurrentDaewoonPillar(manse, saved!.gender, birthYearNum)
      : null;

  const manseHeaderParts = useMemo(() => {
    if (!saved || !computed || !manse) return null;
    const name = (saved.name || "").trim() || "이름 없음";
    const y = parseInt(saved.year, 10);
    const m = parseInt(saved.month, 10);
    const d = parseInt(saved.day, 10);
    const conv = computed.convertedDate;
    const solarPart = `양력 ${y}년 ${m}월 ${d}일`;
    const lunarPart = conv ? `음력 ${conv.year}년 ${conv.month}월 ${conv.day}일` : "";
    let calendarPhrase: string;
    if (saved.calendarType === "solar") {
      calendarPhrase = lunarPart ? `${solarPart} · ${lunarPart}` : solarPart;
    } else {
      const lunInput = `음력 ${y}년 ${m}월 ${d}일${saved.calendarType === "lunar-leap" ? " 윤달" : ""}`;
      calendarPhrase = conv ? `${lunInput} · 양력 ${conv.year}년 ${conv.month}월 ${conv.day}일` : lunInput;
    }
    const tw = branchTimeWindow(manse.hour.ji);
    const timePart = tw ? `${toHanjaJi(manse.hour.ji)}시 · ${tw}` : "";
    return { name, calendarPhrase, timePart };
  }, [saved, computed, manse]);

  const sheetNode =
    mounted &&
    sheetOpen &&
    hasData &&
    manse &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        className="y-modal open y-modal--manse-detail"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setSheetOpen(false);
        }}
      >
        <div className="y-modal-sheet y-manse-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="y-manse-detail-title">
          <div className="y-modal-handle" />
          <div className="y-modal-head">
            <span style={{ width: 32 }} aria-hidden />
            <div className="y-modal-title" id="y-manse-detail-title">
              전체 만세력
            </div>
            <button type="button" className="y-modal-close" onClick={() => setSheetOpen(false)} aria-label="닫기">
              ×
            </button>
          </div>
          <div className="y-modal-scroll y-manse-detail-scroll">
            {manseHeaderParts ? (
              <header className="y-manse-detail-header">
                <div className="y-manse-detail-header-body">
                  <span className="y-manse-detail-header-name">{manseHeaderParts.name}</span>
                  <span className="y-manse-detail-header-cal">{manseHeaderParts.calendarPhrase}</span>
                  {manseHeaderParts.timePart ? (
                    <span className="y-manse-detail-header-time">{manseHeaderParts.timePart}</span>
                  ) : null}
                </div>
              </header>
            ) : null}
            <div className="y-manse-detail-table-wrap">
              <table className="y-manse-detail-table y-manse-detail-table--matrix">
                <thead>
                  <tr>
                    <th scope="col" className="y-manse-col-gubun">
                      <div className="y-manse-thead-fill">
                        <span className="y-manse-thead-label">구분</span>
                      </div>
                    </th>
                    {MANSE_COLS.map((c) => (
                      <th key={c.key} scope="col">
                        <div className="y-manse-thead-fill">
                          <span className="y-manse-thead-label">{c.label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <GubunTh main="십성" sub="(천간)" />
                    {manseColCells(manse, (p) => (
                      <ManseTwoLineCell
                        lineKo={p.sibsung}
                        lineHj={hanjaOrKo(SIBSUNG_HANJA, p.sibsung)}
                        elemClass={elementClassFromStemOrBranch(p.gan)}
                      />
                    ))}
                  </tr>
                  <tr>
                    <GubunTh main="음양오행" sub="(천간)" />
                    {manseColCells(manse, (p) => {
                      const oh = ohangHangulFromStemOrBranch(p.gan);
                      const hj = OH_HANJA[oh] ?? "木";
                      const ko = `${stemEumyangHangul(p.gan)}${oh}`;
                      return <ManseTwoLineCell lineKo={ko} lineHj={hj} elemClass={elementClassFromStemOrBranch(p.gan)} />;
                    })}
                  </tr>
                  <tr>
                    <GubunTh main="천간" />
                    {manseColCells(manse, (p) => (
                      <ManseTwoLineCell lineKo={p.gan} lineHj={toHanjaGan(p.gan)} elemClass={elementClassFromStemOrBranch(p.gan)} />
                    ))}
                  </tr>
                  <tr>
                    <GubunTh main="지지" />
                    {manseColCells(manse, (p) => (
                      <ManseTwoLineCell lineKo={p.ji} lineHj={toHanjaJi(p.ji)} elemClass={elementClassFromStemOrBranch(p.ji)} />
                    ))}
                  </tr>
                  <tr>
                    <GubunTh main="음양오행" sub="(지지)" />
                    {manseColCells(manse, (p) => {
                      const oh = ohangHangulFromStemOrBranch(p.ji);
                      const hj = OH_HANJA[oh] ?? "木";
                      const ko = `${branchEumyangHangul(p.ji)}${oh}`;
                      return <ManseTwoLineCell lineKo={ko} lineHj={hj} elemClass={elementClassFromStemOrBranch(p.ji)} />;
                    })}
                  </tr>
                  <tr>
                    <GubunTh main="십성" sub="(지지)" />
                    {manseColCells(manse, (p) => (
                      <ManseTwoLineCell
                        lineKo={p.jiSibsung}
                        lineHj={hanjaOrKo(SIBSUNG_HANJA, p.jiSibsung)}
                        elemClass={elementClassFromStemOrBranch(p.ji)}
                      />
                    ))}
                  </tr>
                  <tr>
                    <GubunTh main="지장간" />
                    {manseColCells(manse, (p) => {
                      const { ko, hj } = formatJijangganLines(p.ji);
                      const stems = getJijangganForJi(p.ji);
                      const elem = stems[0] ? elementClassFromStemOrBranch(stems[0]) : undefined;
                      return <ManseTwoLineCell lineKo={ko} lineHj={hj} elemClass={elem} />;
                    })}
                  </tr>
                  <tr>
                    <GubunTh main="십이운성" />
                    {manseColCells(manse, (p) => (
                      <ManseTwoLineCell
                        lineKo={p.sibiunsung}
                        lineHj={hanjaOrKo(SIBIUNSUNG_HANJA, p.sibiunsung)}
                        elemClass={elementClassFromStemOrBranch(p.ji)}
                      />
                    ))}
                  </tr>
                  <tr>
                    <GubunTh main="십이신살" />
                    {manseColCells(manse, (p) => (
                      <ManseTwoLineCell
                        lineKo={p.sibisinsal}
                        lineHj={hanjaOrKo(SINSAL_HANJA, p.sibisinsal)}
                        elemClass={elementClassFromStemOrBranch(p.ji)}
                      />
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );

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
            <div className="y-my-p-glyph-stack">
              <div
                className={
                  p.gan ? `y-my-p-cheon ${elementClassFromGan(p.gan)}` : "y-my-p-cheon y-my-p-cheon--placeholder"
                }
              >
                {p.gan ? formatHangulHanjaGan(p.gan) : "—"}
              </div>
              <div className={p.ji ? "y-my-p-ji" : "y-my-p-ji y-my-p-ji--placeholder"}>
                {p.ji ? formatHangulHanjaJi(p.ji) : "—"}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="y-my-saju-summary" aria-label="요약">
        <div className="y-my-summary-item">
          <div className="y-my-summary-label">일주</div>
          <div className="y-my-summary-value">
            {hasData ? <strong>{formatIljuHangulHanja(manse!.day.gan, manse!.day.ji)}</strong> : <strong className="y-my-summary-placeholder">—</strong>}
          </div>
        </div>
        <div className="y-my-summary-item">
          <div className="y-my-summary-label">용신</div>
          <div className="y-my-summary-value">
            {hasData ? (
              <strong>
                {formatHangulHanjaGan(manse!.month.gan)} · {manse!.month.sibsung}({hanjaOrKo(SIBSUNG_HANJA, manse!.month.sibsung)})
              </strong>
            ) : (
              <strong className="y-my-summary-placeholder">—</strong>
            )}
          </div>
        </div>
        <div className="y-my-summary-item">
          <div className="y-my-summary-label">현재 대운</div>
          <div className="y-my-summary-value">
            {hasData && daewoonSummary ? (
              <strong>
                {formatIljuHangulHanja(daewoonSummary.gan, daewoonSummary.ji)} · {daewoonSummary.ageFrom} → {daewoonSummary.ageTo}세
              </strong>
            ) : (
              <strong className="y-my-summary-placeholder">—</strong>
            )}
          </div>
        </div>
        <div className="y-my-summary-item">
          <div className="y-my-summary-label">신살</div>
          <div className="y-my-summary-value">
            {hasData ? (
              <strong>
                {formatSinsalHangulHanja(manse!.day.sibisinsal)} · {formatSinsalHangulHanja(manse!.year.sibisinsal)}
              </strong>
            ) : (
              <strong className="y-my-summary-placeholder">—</strong>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="y-my-saju-cta"
        disabled={!hasData}
        onClick={() => hasData && setSheetOpen(true)}
      >
        전체 만세력 분석 보기 →
      </button>
      {sheetNode}
    </div>
  );
}

export const __YEONUN_SAJU_STORAGE_KEY__ = STORAGE_KEY;
