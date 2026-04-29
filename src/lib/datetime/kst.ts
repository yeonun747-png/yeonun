/**
 * 한국 표준시(KST, IANA Asia/Seoul). 한국은 일광절약시 없이 연중 UTC+9.
 * 오늘 탭·음성/점사 프롬프트 등 클라이언트·서버 공용.
 */
export const KST_IANA = "Asia/Seoul" as const;

function pad2(n: number) {
  return String(Math.trunc(n)).padStart(2, "0");
}

/** KST 기준 시각의 연·월·일·시·분·초(숫자). 서버 TZ와 무관. */
export function getKstParts(date: Date = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_IANA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const pick = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
  };
}

/** 프롬프트·로그용 ISO 형식 문자열 (오프셋 +09:00 고정). */
export function formatKstIso8601Offset(date: Date = new Date()): string {
  const { year, month, day, hour, minute, second } = getKstParts(date);
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}+09:00`;
}

/** 오늘 탭 상단 영문 줄 (예: SUN, APR 29 · 2026). */
export function formatKstConsultHeaderEn(date: Date = new Date()): string {
  const { year, day } = getKstParts(date);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: KST_IANA, weekday: "short" }).format(date);
  const mon = new Intl.DateTimeFormat("en-US", { timeZone: KST_IANA, month: "short" }).format(date);
  return `${wd.toUpperCase()}, ${mon.toUpperCase()} ${day} · ${year}`;
}

/** 오늘 탭 한글 날짜 줄 (예: 2026년 4월 29일 화요일). */
export function formatKstConsultHeaderKo(date: Date = new Date()): string {
  const { year, month, day } = getKstParts(date);
  const wd = new Intl.DateTimeFormat("ko-KR", { timeZone: KST_IANA, weekday: "long" }).format(date);
  return `${year}년 ${month}월 ${day}일 ${wd}`;
}

/** 섹션 헤더 옆 짧은 표기 (예: 04.29). */
export function formatKstMonthDayDot(date: Date = new Date()): string {
  const { month, day } = getKstParts(date);
  return `${pad2(month)}.${pad2(day)}`;
}

/**
 * 사주 명식(만세력) 텍스트와 함께 API로 넘길 KST 문단.
 * 만세력 본문이 비어 있으면 KST만 반환(상담 시각 고지).
 */
export function formatKstBlockForManseContext(date: Date = new Date()): string {
  const iso = formatKstIso8601Offset(date);
  const ko = formatKstConsultHeaderKo(date);
  return `[한국 표준시(KST) 기준 시각]\n- ISO 8601: ${iso}\n- 한국어 표기: ${ko}`;
}

export function appendKstToManseContext(manseLines: string, date: Date = new Date()): string {
  const kst = formatKstBlockForManseContext(date);
  const m = manseLines.trim();
  if (!m) return kst;
  return `${m}\n\n${kst}`;
}
