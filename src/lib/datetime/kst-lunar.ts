/**
 * KST(Asia/Seoul) 양력 하루 → 음력 표기 + 세차·월건(한글 + 한자 병기).
 * 변환은 이미 프로젝트에서 쓰는 `kor-lunar`의 `toLunar`를 사용한다.
 */

import korLunar from "kor-lunar";

import { toHanjaGan, toHanjaJi } from "@/lib/manse-ryeok";

import { getKstParts } from "./kst";

/** 한글 간지 두 글자(천간+지지) → 한자 병기 (예: 병오 → 丙午) */
function hangulGanjiPairToHanja(pair: string): string {
  const s = pair.trim();
  if (s.length < 2) return s;
  const gan = s[0]!;
  const ji = s[1]!;
  return `${toHanjaGan(gan)}${toHanjaJi(ji)}`;
}

/**
 * 오늘 탭 상단 음력 한 줄.
 * 예: `음력 2월 9일 · 병오년(丙午年) 임진월(壬辰月)` (KST 해당일 기준, 윤달이면 월 앞에 윤 표기)
 */
export function formatKstTodayLunarHeader(date: Date = new Date()): string {
  const { year, month, day } = getKstParts(date);
  if (year < 1890 || year > 2050) {
    return "음력 · 1890~2050년 범위 밖 날짜입니다";
  }
  try {
    const L = korLunar.toLunar(year, month, day);
    const monthLabel = L.isLeapMonth ? `윤${L.month}` : String(L.month);
    const dayLine = `음력 ${monthLabel}월 ${L.day}일`;

    const se = (L.secha ?? "").trim();
    const wo = (L.wolgeon ?? "").trim();

    const seHan = se.length >= 2 ? hangulGanjiPairToHanja(se) : "";
    const yearSeg = se && seHan ? `${se}년(${seHan}年)` : "";

    let monthSeg = "";
    if (wo.length >= 2) {
      const woHan = hangulGanjiPairToHanja(wo);
      monthSeg = ` ${wo}월(${woHan}月)`;
    }

    if (!yearSeg) {
      return dayLine;
    }
    return `${dayLine} · ${yearSeg}${monthSeg}`;
  } catch {
    return "음력 · 변환에 실패했습니다";
  }
}
