/**
 * 음성 상담 히스토리 — 타입·포맷 (Supabase/env 없음). 클라이언트는 이 파일만 import.
 */

import { KST_IANA } from "@/lib/datetime/kst";

export type VoiceCallHistoryRowVm = {
  id: string;
  character_key: string;
  consultantName: string;
  /** 예: 04.28 오후 11:24 */
  timeLine: string;
  /** 우측 배지 */
  badge: string;
  /** 상담 요약·메모리 요약 등 결과 텍스트 */
  resultSnippet: string | null;
  /** 월 그룹용 */
  started_at: string;
};

/** 목록 월 제목 (예: 2026년 4월) */
export function voiceCallHistoryMonthHeading(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: KST_IANA,
      year: "numeric",
      month: "long",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function formatVoiceDurationKo(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}분 ${String(r).padStart(2, "0")}초`;
}

/** 종료 요약 배지: 무료 구간 추정 + 일반 통화 시간 */
export function formatVoiceHistoryBadge(durationSec: number, costKrw: number): string {
  if (durationSec <= 0) return "기록 없음";
  if (costKrw === 0 && durationSec <= 180) return "3분 무료";
  return formatVoiceDurationKo(durationSec);
}

/** 한 줄 시각 (스샷과 유사) */
export function formatVoiceHistoryTimeLine(iso: string): string {
  try {
    const d = new Date(iso);
    const ymd = new Intl.DateTimeFormat("sv-SE", {
      timeZone: KST_IANA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    const [, mm, dd] = ymd.split("-");
    const hm = new Intl.DateTimeFormat("ko-KR", {
      timeZone: KST_IANA,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
    return `${mm}.${dd} ${hm}`;
  } catch {
    return "";
  }
}

export function pickVoiceResultSnippet(summary: string | null | undefined, memorySummary: string | null | undefined): string | null {
  const s = String(summary ?? "").trim();
  if (s) return s.length > 280 ? `${s.slice(0, 277)}…` : s;
  const m = String(memorySummary ?? "").trim();
  if (m) return m.length > 280 ? `${m.slice(0, 277)}…` : m;
  return null;
}

export function groupVoiceHistoryByKstMonth(
  rows: VoiceCallHistoryRowVm[],
): { monthLabel: string; rows: VoiceCallHistoryRowVm[] }[] {
  const sorted = [...rows].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
  const groups: { monthLabel: string; rows: VoiceCallHistoryRowVm[] }[] = [];
  for (const row of sorted) {
    const label = voiceCallHistoryMonthHeading(row.started_at);
    const last = groups[groups.length - 1];
    if (last?.monthLabel === label) last.rows.push(row);
    else groups.push({ monthLabel: label, rows: [row] });
  }
  return groups;
}
