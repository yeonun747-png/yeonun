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
  /** 월 그룹용 */
  started_at: string;
};

/** 점사 보관함과 동일 — 음성상담 보관함 목록·조회 기간(일) */
export const VOICE_CALL_ARCHIVE_LIST_DAYS = 60;

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

/** 종료 요약 배지: 실제 통화 길이(초) */
export function formatVoiceHistoryBadge(durationSec: number): string {
  if (durationSec <= 0) return "기록 없음";
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
