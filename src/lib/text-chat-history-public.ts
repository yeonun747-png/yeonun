/**
 * 텍스트 대화 히스토리 — 타입·포맷·그룹 (Supabase/env 없음).
 * 클라이언트 컴포넌트는 반드시 이 모듈만 import.
 */

import { formatKstDateKey, formatKstMonthDayDot, getKstParts, KST_IANA } from "@/lib/datetime/kst";

export type TextChatListRow = {
  id: string;
  character_key: string;
  character_name: string;
  started_at: string;
  retention_until: string | null;
  message_count: number;
};

export type TextChatMessageRow = {
  id: string;
  role: "user" | "assistant";
  body: string;
  created_at: string;
};

export type TextChatDetail = {
  id: string;
  character_key: string;
  character_name: string;
  character_han: string;
  started_at: string;
  retention_until: string | null;
  messages: TextChatMessageRow[];
};

export type TextChatMessageGroupedDay = {
  dayKey: string;
  dayTitle: string;
  messages: TextChatMessageRow[];
};

function pad2(n: number) {
  return String(Math.trunc(n)).padStart(2, "0");
}

/** 보관 안내 문구용 YYYY.MM.DD (KST) */
export function formatKstYmdDots(iso: string): string {
  try {
    const d = new Date(iso);
    const { year, month, day } = getKstParts(d);
    return `${year}.${pad2(month)}.${pad2(day)}`;
  } catch {
    return "";
  }
}

/** 말풍선 옆 시각 (예: 오후 11:18) */
export function formatKstAmpmHm(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: KST_IANA,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** 날짜 구분선: 2026년 4월 26일 */
export function formatKstHistoryDayTitle(iso: string): string {
  try {
    const d = new Date(iso);
    const { year, month, day } = getKstParts(d);
    return `${year}년 ${month}월 ${day}일`;
  } catch {
    return "";
  }
}

export function textChatListMonthHeading(iso: string): string {
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

export function groupTextChatRowsByKstMonth(
  rows: TextChatListRow[],
): { monthLabel: string; rows: TextChatListRow[] }[] {
  const sorted = [...rows].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
  const groups: { monthLabel: string; rows: TextChatListRow[] }[] = [];
  for (const row of sorted) {
    const label = textChatListMonthHeading(row.started_at);
    const last = groups[groups.length - 1];
    if (last?.monthLabel === label) last.rows.push(row);
    else groups.push({ monthLabel: label, rows: [row] });
  }
  return groups;
}

export function isUuidSessionId(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v ?? "").trim());
}

/** 목록 메타 줄 MM.DD */
export function formatTextChatListDayDot(iso: string): string {
  try {
    return formatKstMonthDayDot(new Date(iso));
  } catch {
    return "";
  }
}

export function groupTextChatMessagesByKstDay(messages: TextChatMessageRow[]): TextChatMessageGroupedDay[] {
  const groups: TextChatMessageGroupedDay[] = [];
  for (const m of messages) {
    const dayKey = formatKstDateKey(new Date(m.created_at));
    const last = groups[groups.length - 1];
    if (last?.dayKey === dayKey) last.messages.push(m);
    else groups.push({ dayKey, dayTitle: formatKstHistoryDayTitle(m.created_at), messages: [m] });
  }
  return groups;
}
