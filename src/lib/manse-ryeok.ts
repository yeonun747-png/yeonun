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

function stemMetaphor(gan: string) {
  const han = toHanjaGan(gan);
  const oh = OHENG[gan] ?? "";
  const label = `${gan}${oh ? oh : ""}(${han}${oh ? ohangHanja(oh) : ""})`;
  const desc =
    gan === "갑"
      ? "하늘을 향해 쭉 뻗는 큰 나무처럼 곧고 주도적인 기운이에요."
      : gan === "을"
        ? "바람에 흔들리며 자라나는 풀·덩굴처럼 유연하고 섬세한 기운이에요."
        : gan === "병"
          ? "햇살처럼 밝고 확장하는 열정의 기운이에요."
          : gan === "정"
            ? "촛불처럼 따뜻하게 비추는 집중과 배려의 기운이에요."
            : gan === "무"
              ? "큰 산처럼 든든하게 버티는 중심의 기운이에요."
              : gan === "기"
                ? "기름진 흙처럼 받아주고 키우는 돌봄의 기운이에요."
                : gan === "경"
                  ? "잘 벼린 칼처럼 결단과 정리가 빠른 기운이에요."
                  : gan === "신"
                    ? "보석처럼 단정하고 기준이 분명한 기운이에요."
                    : gan === "임"
                      ? "큰 강처럼 흐름이 크고 유연한 기운이에요."
                      : gan === "계"
                        ? "이슬비처럼 조용히 스며드는 감각의 기운이에요."
                        : "그 글자만의 고유한 성향이 있어요.";
  return { label, desc };
}

function branchMetaphor(ji: string) {
  const han = toHanjaJi(ji);
  const oh = OHENG[ji] ?? "";
  const label = `${ji}${oh ? oh : ""}(${han}${oh ? ohangHanja(oh) : ""})`;
  const desc =
    ji === "인"
      ? "시작과 추진력이 강해요."
      : ji === "묘"
        ? "관계와 감각이 섬세해요."
        : ji === "진"
          ? "기반을 다지고 쌓아가는 힘이 있어요."
          : ji === "사"
            ? "몰입과 집중이 좋아요."
            : ji === "오"
              ? "표현과 자신감이 강해요."
              : ji === "미"
                ? "정서·돌봄의 기운이 있어요."
                : ji === "신"
                  ? "변화에 빠르고 머리가 잘 돌아가요."
                  : ji === "유"
                    ? "정리정돈·완성도가 중요해요."
                    : ji === "술"
                      ? "원칙과 책임감이 있어요."
                      : ji === "해"
                        ? "직관과 상상력이 좋아요."
                        : ji === "자"
                          ? "감수성이 깊고 생각이 많아요."
                          : ji === "축"
                            ? "끈기와 인내가 강해요."
                            : "그 지지만의 기운이 있어요.";
  return { label, desc };
}

function pillarSlotLabel(pillarType: "year" | "month" | "day" | "hour") {
  if (pillarType === "year") return "년주";
  if (pillarType === "month") return "월주";
  if (pillarType === "day") return "일주";
  return "시주";
}

/** 이 기둥이 사주 안에서 어떻게 읽히는지 한 문장(사전식 정의보다, 클릭한 칸 맥락). */
function pillarReadingHint(pillarType: "year" | "month" | "day" | "hour") {
  if (pillarType === "year") return "명식에서 이 칸은 보통 어린 시절·가족·타고난 환경기운으로 많이 읽어요.";
  if (pillarType === "month") return "밖에서의 역할, 사회·커리어 리듬과 잘 맞물리는 자리예요.";
  if (pillarType === "day") return "사주에서 ‘나’를 가장 직접 보는, 본인 기둥이에요.";
  return "앞으로의 흐름·마무리·방향성과도 잘 연결되는 자리예요.";
}

function dayStemTrait(dayGan: string) {
  return dayGan === "갑"
    ? "강한 의지와 리더십이 특징이에요."
    : dayGan === "을"
      ? "유연함과 공감 능력이 돋보여요."
      : dayGan === "병"
        ? "밝고 추진력 있는 성향이 강해요."
        : dayGan === "정"
          ? "섬세함과 집중력이 강해요."
          : dayGan === "무"
            ? "중심을 잡고 책임지는 힘이 있어요."
            : dayGan === "기"
              ? "배려하고 조율하는 힘이 좋아요."
              : dayGan === "경"
                ? "결단력과 실행력이 강해요."
                : dayGan === "신"
                  ? "정확함과 완성도를 중시해요."
                  : dayGan === "임"
                    ? "유연한 사고와 큰 흐름을 보는 힘이 있어요."
                    : dayGan === "계"
                      ? "직관과 섬세한 감각이 좋아요."
                      : "그 일간만의 특성이 있어요.";
}

function ohangHanja(oh: string) {
  if (oh === "목") return "木";
  if (oh === "화") return "火";
  if (oh === "토") return "土";
  if (oh === "금") return "金";
  if (oh === "수") return "水";
  return "";
}

/** 명식에서 연·월·일·시 칸 클릭 시: 해당 유저의 그 기둥(간지) 중심 설명(엔진 십성 포함). */
export function explainMansePillar(
  pillarType: "year" | "month" | "day" | "hour",
  p: MansePillar,
  userName?: string,
) {
  const display = (userName ?? "").trim();
  const who = display ? `${display}님` : "회원님";
  const slot = pillarSlotLabel(pillarType);
  const stem = stemMetaphor(p.gan);
  const branch = branchMetaphor(p.ji);
  /** 말풍선 등 UI용: 한자(한문) 없이 한글 간지·오행만 표기 */
  const ganHangulLabel = OHENG[p.gan] ? `${p.gan}${OHENG[p.gan]}` : p.gan;
  const jiHangulLabel = OHENG[p.ji] ? `${p.ji}${OHENG[p.ji]}` : p.ji;

  const core = `${who} 명식의 ${slot}는 ${p.gan}${p.ji}예요. 천간 ${ganHangulLabel}은 ${stem.desc} 지지 ${jiHangulLabel}은 ${branch.desc}`;

  if (pillarType === "day") {
    const tail = `같은 기둥이 곧 본인이라 ${dayStemTrait(p.gan)} 지지는 일간과 「${p.jiSibsung}」 관계로도 봐요. ${pillarReadingHint(pillarType)}`;
    return `${core} ${tail}`.replace(/\s+/g, " ").trim();
  }

  const tail = `일간을 기준으로 천간은 「${p.sibsung}」, 지지는 「${p.jiSibsung}」에 해당해요. ${pillarReadingHint(pillarType)}`;
  return `${core} ${tail}`.replace(/\s+/g, " ").trim();
}

/** 60갑자 순번(0=甲子 … 59=癸亥) */
export function gapjaIndexFromGanJi(ganHangul: string, jiHangul: string): number {
  for (let n = 0; n < 60; n++) {
    if (SIBGAN_HANGUL[n % 10] === ganHangul && SIBIJI_HANGUL[n % 12] === jiHangul) return n;
  }
  return 0;
}

export function ganJiFromGapjaIndex(n: number): { gan: string; ji: string } {
  const i = ((n % 60) + 60) % 60;
  return { gan: SIBGAN_HANGUL[i % 10], ji: SIBIJI_HANGUL[i % 12] };
}

/** 양남·음녀 순행 / 음남·양녀 역행 — 월주 인접 간지부터 8대운(간지만, 대운수 보정 없음) */
export function buildDaewoonGanJiSequence(manse: ManseRyeokData, gender: "male" | "female"): { gan: string; ji: string }[] {
  const monthIdx = gapjaIndexFromGanJi(manse.month.gan, manse.month.ji);
  const yearGanIdx = SIBGAN_HANGUL.indexOf(manse.year.gan);
  const yearIsYang = yearGanIdx >= 0 && yearGanIdx % 2 === 0;
  const forward = (yearIsYang && gender === "male") || (!yearIsYang && gender === "female");
  let idx = forward ? (monthIdx + 1) % 60 : (monthIdx + 59) % 60;
  const out: { gan: string; ji: string }[] = [];
  for (let i = 0; i < 8; i++) {
    out.push(ganJiFromGapjaIndex(idx));
    idx = forward ? (idx + 1) % 60 : (idx + 59) % 60;
  }
  return out;
}

export function getJijangganForJi(jiHangul: string): string[] {
  const list = JIJANGGAN[jiHangul];
  return list ? [...list] : [];
}

/** 만 나이(한국식 세는 나이), 표시용 대운 연령대 슬롯(0~7) */
export function koreanAgeFromBirthYear(birthYear: number, refYear = new Date().getFullYear()): number {
  if (!Number.isFinite(birthYear)) return 1;
  return refYear - birthYear + 1;
}

export function currentDaewoonAgeBand(koreanAge: number): { slot: number; ageFrom: number; ageTo: number } {
  const slot = Math.min(7, Math.max(0, Math.floor((koreanAge - 1) / 10)));
  return { slot, ageFrom: slot * 10 + 1, ageTo: slot * 10 + 10 };
}

export function getCurrentDaewoonPillar(
  manse: ManseRyeokData,
  gender: "male" | "female",
  birthYear: number
): { gan: string; ji: string; ageFrom: number; ageTo: number } | null {
  const seq = buildDaewoonGanJiSequence(manse, gender);
  if (!seq.length) return null;
  const ka = koreanAgeFromBirthYear(birthYear);
  const { slot, ageFrom, ageTo } = currentDaewoonAgeBand(ka);
  const p = seq[slot] ?? seq[0];
  return { gan: p.gan, ji: p.ji, ageFrom, ageTo };
}

export function elementClassFromGan(ganHangul: string): "wood" | "fire" | "earth" | "metal" | "water" {
  const e = OHENG[ganHangul];
  if (e === "목") return "wood";
  if (e === "화") return "fire";
  if (e === "토") return "earth";
  if (e === "금") return "metal";
  return "water";
}

/** 천간·지지 한글 모두 오행 색 분류에 사용 가능 */
export function elementClassFromStemOrBranch(hangul: string): "wood" | "fire" | "earth" | "metal" | "water" {
  return elementClassFromGan(hangul);
}

export function stemEumyangHangul(ganHangul: string): string {
  return EUMYANG_GAN[ganHangul] || "양";
}

export function branchEumyangHangul(jiHangul: string): string {
  return EUMYANG_JI[jiHangul] || "양";
}

export function ohangHangulFromStemOrBranch(hangul: string): string {
  return OHENG[hangul] || "목";
}

