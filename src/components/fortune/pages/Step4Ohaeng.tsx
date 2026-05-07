"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  computeFiveElementPct,
  computeStrengthSpectrum,
  suggestYongsinBadges,
} from "@/lib/fortune-ux/manseViz";
import type { ManseRyeokData } from "@/lib/manse-ryeok";
import { readStoredSaju } from "@/lib/fortune-ux/sajuStorage";

const ELEMENTS = [
  ["wood", "木", "목"],
  ["fire", "火", "화"],
  ["earth", "土", "토"],
  ["metal", "金", "금"],
  ["water", "水", "수"],
] as const;

/** 오행 비율(%) 구간별 표시 — 결핍(0) · 부족(1~14) · 적정(15~29) · 과다(30~) — 정수 %로 판정 */
function ohaengBalanceLabel(pct: number): string {
  const p = Math.round(pct);
  if (p === 0) return "결핍";
  if (p <= 14) return "부족";
  if (p <= 29) return "적정";
  return "과다";
}

function ohaengBalanceColor(pct: number): string {
  const p = Math.round(pct);
  if (p === 0) return "var(--purple)";
  if (p <= 14) return "#D05000";
  if (p <= 29) return "var(--green)";
  return "var(--rose)";
}

function ohangHanja(ko: string) {
  if (ko === "목") return "木";
  if (ko === "화") return "火";
  if (ko === "토") return "土";
  if (ko === "금") return "金";
  if (ko === "수") return "水";
  return "";
}

function ohangKey(ko: string) {
  if (ko === "목") return "wood";
  if (ko === "화") return "fire";
  if (ko === "토") return "earth";
  if (ko === "금") return "metal";
  if (ko === "수") return "water";
  return "unknown";
}

function OhaengBar({
  elKey,
  han,
  value,
}: {
  elKey: (typeof ELEMENTS)[number][0];
  han: string;
  value: number;
}) {
  const target = Math.max(4, Math.min(100, value));
  const [wide, setWide] = useState(false);
  const [showPct, setShowPct] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setWide(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="y-fortune-v2-bar-row">
      <span className={`el el--${elKey}`}>{han}</span>
      <div className="bar">
        <i
          className={`fill fill--${elKey}${wide ? " is-expanded" : ""}`}
          style={{ "--ohaeng-target": `${target}%` } as CSSProperties}
          onTransitionEnd={(e) => {
            if (e.propertyName !== "width") return;
            setShowPct(true);
          }}
        >
          {showPct && target > 16 ? `${value}%` : ""}
        </i>
      </div>
      <span className="state" style={{ color: ohaengBalanceColor(value), fontWeight: 800 }}>
        {ohaengBalanceLabel(value)}
      </span>
    </div>
  );
}

export function Step4Ohaeng({ manse, onNext }: { manse: ManseRyeokData; onNext: () => void }) {
  const pct = computeFiveElementPct(manse);
  const spectrum = computeStrengthSpectrum(manse);
  const badges = suggestYongsinBadges(manse);
  const stored = readStoredSaju();
  const displayName = stored?.name?.trim() || "회원";
  return (
    <section className="y-fortune-v2-page">
      <div className="y-fortune-v2-section-head">
        <h1>오행 분석</h1>
        <p>{displayName}님 사주의 에너지 분포</p>
      </div>
      <div className="y-fortune-v2-ohaeng-card">
        {ELEMENTS.map(([key, han]) => (
          <OhaengBar key={key} elKey={key} han={han} value={pct[key]} />
        ))}
      </div>
      <div className="y-fortune-v2-gods">
        <div>
          <span>용신 用神</span>
          <b className={`ohaeng ohaeng--${ohangKey(badges.yong)}`}>
            {badges.yong}({ohangHanja(badges.yong)})
          </b>
        </div>
        <div>
          <span>희신 喜神</span>
          <b className={`ohaeng ohaeng--${ohangKey(badges.hee)}`}>
            {badges.hee}({ohangHanja(badges.hee)})
          </b>
        </div>
        <div>
          <span>기신 忌神</span>
          <b className={`ohaeng ohaeng--${ohangKey(badges.gi)}`}>
            {badges.gi}({ohangHanja(badges.gi)})
          </b>
        </div>
      </div>
      <div className="y-fortune-v2-spectrum">
        <div className="y-fortune-v2-card-kicker">신강 · 신약 분석</div>
        <div className="track">
          <i style={{ left: `${((spectrum.score + 5) / 10) * 100}%` }} />
        </div>
        <div className="scale">
          {["극약", "태약", "신약", "중화", "신강", "태강", "극왕"].map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
        <strong>{spectrum.label} 사주입니다</strong>
      </div>
      <button className="y-fortune-v2-primary" type="button" onClick={onNext}>
        별하선생님 질문 →
      </button>
    </section>
  );
}
