// reunionf82의 만세력(사주명식) 계산 엔진을 yeonun으로 이식
// (원본: reunionf82/lib/manse-ryeok.ts)

// 십간 (天干)
const SIBGAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const SIBGAN_HANGUL = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];

// 십이지 (地支)
const SIBIJI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const SIBIJI_HANGUL = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];

// 지장간 (地支藏干)
const JIJANGGAN: Record<string, string[]> = {
  자: ["계"],
  축: ["기", "신", "계"],
  인: ["갑", "병", "무"],
  묘: ["을"],
  진: ["을", "무", "계"],
  사: ["병", "무", "경"],
  오: ["정", "기"],
  미: ["정", "을", "기"],
  신: ["경", "임", "무"],
  유: ["신"],
  술: ["신", "정", "무"],
  해: ["임", "갑"],
};

// 십성 (十神)
const SIBSUNG: Record<string, string> = {
  // 갑(목)
  갑갑: "비견",
  갑을: "겁재",
  갑병: "식신",
  갑정: "상관",
  갑무: "편재",
  갑기: "정재",
  갑경: "편관",
  갑신: "정관",
  갑임: "편인",
  갑계: "정인",
  // 을(목)
  을갑: "겁재",
  을을: "비견",
  을병: "상관",
  을정: "식신",
  을무: "정재",
  을기: "편재",
  을경: "정관",
  을신: "편관",
  을임: "정인",
  을계: "편인",
  // 병(화)
  병갑: "편인",
  병을: "정인",
  병병: "비견",
  병정: "겁재",
  병무: "식신",
  병기: "상관",
  병경: "편재",
  병신: "정재",
  병임: "편관",
  병계: "정관",
  // 정(화)
  정갑: "정인",
  정을: "편인",
  정병: "겁재",
  정정: "비견",
  정무: "상관",
  정기: "식신",
  정경: "정재",
  정신: "편재",
  정임: "정관",
  정계: "편관",
  // 무(토)
  무갑: "편관",
  무을: "정관",
  무병: "편인",
  무정: "정인",
  무무: "비견",
  무기: "겁재",
  무경: "식신",
  무신: "상관",
  무임: "편재",
  무계: "정재",
  // 기(토)
  기갑: "정관",
  기을: "편관",
  기병: "정인",
  기정: "편인",
  기무: "겁재",
  기기: "비견",
  기경: "상관",
  기신: "식신",
  기임: "정재",
  기계: "편재",
  // 경(금)
  경갑: "편재",
  경을: "정재",
  경병: "편관",
  경정: "정관",
  경무: "편인",
  경기: "정인",
  경경: "비견",
  경신: "겁재",
  경임: "식신",
  경계: "상관",
  // 신(금)
  신갑: "정재",
  신을: "편재",
  신병: "정관",
  신정: "편관",
  신무: "정인",
  신기: "편인",
  신경: "겁재",
  신신: "비견",
  신임: "상관",
  신계: "식신",
  // 임(수)
  임갑: "식신",
  임을: "상관",
  임병: "편재",
  임정: "정재",
  임무: "편관",
  임기: "정관",
  임경: "편인",
  임신: "정인",
  임임: "비견",
  임계: "겁재",
  // 계(수)
  계갑: "상관",
  계을: "식신",
  계병: "정재",
  계정: "편재",
  계무: "정관",
  계기: "편관",
  계경: "정인",
  계신: "편인",
  계임: "겁재",
  계계: "비견",
};

// 오행 (五行)
const OHENG: Record<string, string> = {
  갑: "목",
  을: "목",
  병: "화",
  정: "화",
  무: "토",
  기: "토",
  경: "금",
  신: "금",
  임: "수",
  계: "수",
  자: "수",
  축: "토",
  인: "목",
  묘: "목",
  진: "토",
  사: "화",
  오: "화",
  미: "토",
  유: "금",
  술: "토",
  해: "수",
};

// 음양 (陰陽)
const EUMYANG_GAN: Record<string, string> = { 갑: "양", 을: "음", 병: "양", 정: "음", 무: "양", 기: "음", 경: "양", 신: "음", 임: "양", 계: "음" };
const EUMYANG_JI: Record<string, string> = { 자: "양", 축: "음", 인: "양", 묘: "음", 진: "양", 사: "음", 오: "양", 미: "음", 신: "양", 유: "음", 술: "양", 해: "음" };

function getEumyang(value: string, isGan: boolean): string {
  if (isGan) return EUMYANG_GAN[value] || "양";
  return EUMYANG_JI[value] || "양";
}

// 24절기(대략) 기준 월령 계산에 쓰는 절기일
const SOLAR_TERMS_DATE: Record<number, number> = { 1: 6, 2: 4, 3: 6, 4: 5, 5: 6, 6: 6, 7: 7, 8: 8, 9: 8, 10: 8, 11: 7, 12: 7 };

function getMonthIndex(month: number, day: number): number {
  const termDay = SOLAR_TERMS_DATE[month] || 5;
  if (day < termDay) {
    if (month === 1) return 10; // 자월
    if (month === 2) return 11; // 축월
    return month - 3;
  }
  if (month === 1) return 11; // 축월
  if (month === 2) return 0; // 인월
  return month - 2;
}

// 십이운성
const SIBIUNSUNG = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"];

function getSibiunsung(gan: string, ji: string): string {
  const jiIndex = SIBIJI_HANGUL.indexOf(ji);
  const isYang = getEumyang(gan, true) === "양";
  let startJiIndex = 0;
  if (gan === "갑") startJiIndex = 11;
  else if (gan === "을") startJiIndex = 6;
  else if (gan === "병" || gan === "무") startJiIndex = 2;
  else if (gan === "정" || gan === "기") startJiIndex = 9;
  else if (gan === "경") startJiIndex = 5;
  else if (gan === "신") startJiIndex = 0;
  else if (gan === "임") startJiIndex = 8;
  else if (gan === "계") startJiIndex = 3;

  const offset = isYang ? (jiIndex - startJiIndex + 12) % 12 : (startJiIndex - jiIndex + 12) % 12;
  return SIBIUNSUNG[offset];
}

// 십이신살(간단)
function getSibisinsal(targetJi: string, standardJi: string): string {
  const order = ["지살", "도화", "월살", "망신", "장성", "반안", "역마", "육해", "화개", "겁살", "재살", "천살"];
  const standardIndex = SIBIJI_HANGUL.indexOf(standardJi);
  let startIndex = 0;
  if ([8, 0, 4].includes(standardIndex)) startIndex = 8;
  else if ([2, 6, 10].includes(standardIndex)) startIndex = 2;
  else if ([5, 9, 1].includes(standardIndex)) startIndex = 5;
  else if ([11, 3, 7].includes(standardIndex)) startIndex = 11;
  const targetIndex = SIBIJI_HANGUL.indexOf(targetJi);
  const diff = (targetIndex - startIndex + 12) % 12;
  return order[diff];
}

function getGanjiYear(year: number): { gan: string; ji: string } {
  const baseYear = 1984; // 갑자
  let offset = (year - baseYear) % 60;
  if (offset < 0) offset += 60;
  return { gan: SIBGAN_HANGUL[offset % 10], ji: SIBIJI_HANGUL[offset % 12] };
}

function getMonthGanji(year: number, month: number, day: number): { gan: string; ji: string } {
  const monthIndex = getMonthIndex(month, day);
  let actualYear = year;
  if (month === 1 || (month === 2 && day < 4)) actualYear = year - 1;
  const yearGanji = getGanjiYear(actualYear);
  const yearGanIndex = SIBGAN_HANGUL.indexOf(yearGanji.gan);
  const startGanIndex = ((yearGanIndex % 5) * 2 + 2) % 10;
  const monthGanIndex = (startGanIndex + monthIndex) % 10;
  const monthJiIndex = (monthIndex + 2) % 12;
  return { gan: SIBGAN_HANGUL[monthGanIndex], ji: SIBIJI_HANGUL[monthJiIndex] };
}

export function getDayGanji(year: number, month: number, day: number): { gan: string; ji: string } {
  const baseDate = new Date(Date.UTC(1900, 0, 1)); // 1900-01-01
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  const diffDays = Math.floor((targetDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
  let ganIndex = (0 + diffDays) % 10; // 갑
  let jiIndex = (10 + diffDays) % 12; // 술
  if (ganIndex < 0) ganIndex += 10;
  if (jiIndex < 0) jiIndex += 12;
  return { gan: SIBGAN_HANGUL[ganIndex], ji: SIBIJI_HANGUL[jiIndex] };
}

function getHourGanji(dayGan: string, hour: number, minute = 0): { gan: string; ji: string } {
  const dayGanIndex = SIBGAN_HANGUL.indexOf(dayGan);
  const timeVal = hour * 60 + minute;
  const hourJiIndex = Math.floor((timeVal + 30) / 120) % 12;
  const startGanIndex = (dayGanIndex % 5) * 2;
  const hourGanIndex = (startGanIndex + hourJiIndex) % 10;
  return { gan: SIBGAN_HANGUL[hourGanIndex], ji: SIBIJI_HANGUL[hourJiIndex] };
}

export interface MansePillar {
  gan: string;
  ji: string;
  sibsung: string;
  jiSibsung: string;
  ohang: string;
  eumyang: string;
  sibiunsung: string;
  sibisinsal: string;
}
export interface ManseRyeokData {
  year: MansePillar;
  month: MansePillar;
  day: MansePillar;
  hour: MansePillar;
}

function getJiSibsung(dayGan: string, ji: string) {
  const mainGanMap: Record<string, string> = { 자: "계", 축: "기", 인: "갑", 묘: "을", 진: "무", 사: "병", 오: "정", 미: "기", 신: "경", 유: "신", 술: "무", 해: "임" };
  const mainGan = mainGanMap[ji];
  return SIBSUNG[`${dayGan}${mainGan}`] || "비견";
}

export function calculateManseRyeok(year: number, month: number, day: number, hour: number, minute = 0): ManseRyeokData {
  let actualYear = year;
  if (month === 1 || (month === 2 && day < 4)) actualYear = year - 1;
  const yearGanji = getGanjiYear(actualYear);
  const monthGanji = getMonthGanji(year, month, day);
  const dayGanji = getDayGanji(year, month, day);
  const dayGan = dayGanji.gan;
  const hourGanji = getHourGanji(dayGan, hour, minute);

  const yearJi = yearGanji.ji;
  const dayJi = dayGanji.ji;

  const makePillar = (gan: string, ji: string, pillarType: "year" | "month" | "day" | "hour"): MansePillar => ({
    gan,
    ji,
    sibsung: SIBSUNG[`${dayGan}${gan}`] || "비견",
    jiSibsung: getJiSibsung(dayGan, ji),
    ohang: `${OHENG[gan]}/${OHENG[ji]}`,
    eumyang: `${getEumyang(gan, true)}/${getEumyang(ji, false)}`,
    sibiunsung: getSibiunsung(dayGan, ji),
    sibisinsal: getSibisinsal(ji, pillarType === "year" ? dayJi : yearJi),
  });

  return {
    year: makePillar(yearGanji.gan, yearGanji.ji, "year"),
    month: makePillar(monthGanji.gan, monthGanji.ji, "month"),
    day: makePillar(dayGan, dayGanji.ji, "day"),
    hour: makePillar(hourGanji.gan, hourGanji.ji, "hour"),
  };
}

// 음력/양력 변환 (reunionf82와 동일하게 kor-lunar 사용)
import korLunar from "kor-lunar";

export type CalendarType = "solar" | "lunar" | "lunar-leap";

export function convertLunarToSolarAccurate(year: number, month: number, day: number, isLeap = false) {
  try {
    const solarDate = korLunar.toSolar(year, month, day, isLeap);
    if (!solarDate) return null;
    return { year: solarDate.year, month: solarDate.month, day: solarDate.day };
  } catch {
    return null;
  }
}

export function convertSolarToLunarAccurate(year: number, month: number, day: number) {
  try {
    const lunarDate = korLunar.toLunar(year, month, day);
    if (!lunarDate) return null;
    return { year: lunarDate.year, month: lunarDate.month, day: lunarDate.day };
  } catch {
    return null;
  }
}

export function computeManseFromFormInput(params: {
  userYear: string;
  userMonth: string;
  userDay: string;
  userBirthHour?: string | null;
  userBirthMinute?: string | null;
  userCalendarType?: CalendarType;
  userName?: string;
}): { manse: ManseRyeokData; convertedDate: { year: number; month: number; day: number } | null } | null {
  const { userYear, userMonth, userDay, userBirthHour, userBirthMinute, userCalendarType = "solar" } = params;
  if (!userYear || !userMonth || !userDay) return null;
  try {
    const birthYear = parseInt(userYear, 10);
    const birthMonth = parseInt(userMonth, 10);
    const birthDay = parseInt(userDay, 10);
    if (!Number.isFinite(birthYear) || !Number.isFinite(birthMonth) || !Number.isFinite(birthDay)) return null;

    const hourNum = userBirthHour != null && userBirthHour !== "" ? parseInt(String(userBirthHour), 10) : 10;
    const minuteNum = userBirthMinute != null && userBirthMinute !== "" ? parseInt(String(userBirthMinute), 10) : 0;

    const manse = calculateManseRyeok(birthYear, birthMonth, birthDay, Number.isFinite(hourNum) ? hourNum : 10, Number.isFinite(minuteNum) ? minuteNum : 0);

    let convertedDate: { year: number; month: number; day: number } | null = null;
    try {
      if (userCalendarType === "solar") convertedDate = convertSolarToLunarAccurate(birthYear, birthMonth, birthDay);
      else convertedDate = convertLunarToSolarAccurate(birthYear, birthMonth, birthDay, userCalendarType === "lunar-leap");
    } catch {
      convertedDate = null;
    }

    return { manse, convertedDate };
  } catch {
    return null;
  }
}

export function toHanjaGan(ganHangul: string) {
  const index = SIBGAN_HANGUL.indexOf(ganHangul);
  return index >= 0 ? SIBGAN[index] : ganHangul;
}

export function toHanjaJi(jiHangul: string) {
  const index = SIBIJI_HANGUL.indexOf(jiHangul);
  return index >= 0 ? SIBIJI[index] : jiHangul;
}

export function elementClassFromGan(ganHangul: string): "wood" | "fire" | "earth" | "metal" | "water" {
  const e = OHENG[ganHangul];
  if (e === "목") return "wood";
  if (e === "화") return "fire";
  if (e === "토") return "earth";
  if (e === "금") return "metal";
  return "water";
}

