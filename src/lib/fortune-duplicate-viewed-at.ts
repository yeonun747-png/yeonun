import { getKstParts, KST_IANA } from "@/lib/datetime/kst";

/** 점사 본 시각 — "2026년 5월 19일 오후 3시 45분 30초" */
export function formatFortuneViewedAtKo(iso: string): string {
  try {
    const d = new Date(iso);
    const { year, month, day } = getKstParts(d);
    const time = new Intl.DateTimeFormat("ko-KR", {
      timeZone: KST_IANA,
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: true,
    }).format(d);
    return `${year}년 ${month}월 ${day}일 ${time}`;
  } catch {
    return "";
  }
}
