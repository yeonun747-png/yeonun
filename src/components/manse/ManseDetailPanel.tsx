"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";

import {
  branchEumyangHangul,
  computeManseFromFormInput,
  elementClassFromStemOrBranch,
  getJijangganForJi,
  ohangHangulFromStemOrBranch,
  stemEumyangHangul,
  toHanjaGan,
  toHanjaJi,
  type MansePillar,
  type ManseRyeokData,
} from "@/lib/manse-ryeok";
import type { FortuneBirthPayload } from "@/lib/fortune-ux/sajuStorage";

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
const JI_START_HOUR = [23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];

const MANSE_COLS: { key: keyof ManseRyeokData; label: string }[] = [
  { key: "hour", label: "시주" },
  { key: "day", label: "일주" },
  { key: "month", label: "월주" },
  { key: "year", label: "연주" },
];

function pad2(v: string | number) {
  const s = String(v);
  return s.length >= 2 ? s : `0${s}`;
}

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

function formatJijangganLines(ji: string): { ko: string; hj: string } {
  const stems = getJijangganForJi(ji);
  if (!stems.length) return { ko: "—", hj: "—" };
  const ko = stems.join("·");
  const hj = stems.map((s) => toHanjaGan(s)).join("·");
  return { ko, hj };
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

function manseColCells(manse: ManseRyeokData, render: (p: MansePillar) => ReactNode): ReactNode {
  return MANSE_COLS.map(({ key }) => <td key={key}>{render(manse[key])}</td>);
}

export function ManseDetailPanel({
  sajuInput,
  className,
}: {
  sajuInput: FortuneBirthPayload;
  className?: string;
}) {
  const computed = useMemo(
    () =>
      computeManseFromFormInput({
        userYear: sajuInput.year,
        userMonth: sajuInput.month,
        userDay: sajuInput.day,
        userBirthHour: sajuInput.hour || null,
        userBirthMinute: sajuInput.minute || null,
        userCalendarType: sajuInput.calendarType,
        userName: sajuInput.name || "",
      }),
    [sajuInput],
  );

  const manse = computed?.manse ?? null;
  if (!manse) return null;

  const name = (sajuInput.name || "").trim() || "이름 없음";
  const y = parseInt(sajuInput.year, 10);
  const m = parseInt(sajuInput.month, 10);
  const d = parseInt(sajuInput.day, 10);
  const conv = computed?.convertedDate;
  const solarPart = `양력 ${y}년 ${m}월 ${d}일`;
  const lunarPart = conv ? `음력 ${conv.year}년 ${conv.month}월 ${conv.day}일` : "";
  let calendarPhrase: string;
  if (sajuInput.calendarType === "solar") {
    calendarPhrase = lunarPart ? `${solarPart} · ${lunarPart}` : solarPart;
  } else {
    const lunInput = `음력 ${y}년 ${m}월 ${d}일${sajuInput.calendarType === "lunar-leap" ? " 윤달" : ""}`;
    calendarPhrase = conv ? `${lunInput} · 양력 ${conv.year}년 ${conv.month}월 ${conv.day}일` : lunInput;
  }
  const tw = branchTimeWindow(manse.hour.ji);
  const timePart = tw ? `${toHanjaJi(manse.hour.ji)}시 · ${tw}` : "";

  return (
    <div className={className ? `y-manse-detail-panel ${className}` : "y-manse-detail-panel"}>
      <header className="y-manse-detail-header">
        <div className="y-manse-detail-header-body">
          <span className="y-manse-detail-header-name">{name}</span>
          <span className="y-manse-detail-header-cal">{calendarPhrase}</span>
          {timePart ? <span className="y-manse-detail-header-time">{timePart}</span> : null}
        </div>
      </header>
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
  );
}
