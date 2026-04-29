/**
 * 오늘 탭 공통(사주 미입력 포함): KST 양력 일의 일주·짧은 문구·행운 칸.
 * 만세력 엔진(manse-ryeok)만 사용, 개인 사주·클로드 없음.
 */

import { getKstParts } from "@/lib/datetime/kst";
import { getDayGanji, toHanjaGan, toHanjaJi } from "@/lib/manse-ryeok";

/** 지지별 오늘 한 줄 + 해시태그(일간 무관·공개용) */
const BY_JI: Record<
  string,
  {
    msg: string;
    tags: [string, string, string];
  }
> = {
  자: {
    msg: "깊은 밤의 기운이 흐르는 날. 서두르지 말고 내면을 들여다보세요.",
    tags: ["고요의날", "성찰", "쉼"],
  },
  축: {
    msg: "단단히 뿌리내리는 날. 작은 약속도 지키면 복이 쌓입니다.",
    tags: ["믿음", "성실", "뿌리"],
  },
  인: {
    msg: "새싹이 움트는 기운. 시작은 작게, 마음은 크게 가져도 좋습니다.",
    tags: ["새출발", "용기", "성장"],
  },
  묘: {
    msg: "부드럽게 퍼지는 하루. 말보다 분위기가 먼저 전해집니다.",
    tags: ["온기", "배려", "설렘"],
  },
  진: {
    msg: "구름과 비가 스쳐 가는 날. 변화를 두려워하지 마세요.",
    tags: ["전환", "유연함", "기회"],
  },
  사: {
    msg: "햇살이 드는 시간. 드러내도 좋은 것과 지켜야 할 것을 가르세요.",
    tags: ["명료함", "집중", "빛"],
  },
  오: {
    msg: "정오의 열기. 마음이 먼저 달아오르면 한 박자 쉬어가세요.",
    tags: ["열정", "균형", "호흡"],
  },
  미: {
    msg: "느긋한 오후의 온기. 나와 타인을 함께 돌보는 날입니다.",
    tags: ["포용", "치유", "여유"],
  },
  신: {
    msg: "날카로운 바람이 지나갑니다. 판단은 날 세우고 말은 줄이세요.",
    tags: ["분별", "정리", "날카로움"],
  },
  유: {
    msg: "저녁 노을처럼 은은한 하루. 마무리와 감사에 어울립니다.",
    tags: ["감사", "정리", "평온"],
  },
  술: {
    msg: "문지방을 지키는 기운. 지키는 일에 힘이 실립니다.",
    tags: ["지킴", "의리", "경계"],
  },
  해: {
    msg: "깊은 물의 기운이 흐르는 날. 충동보다 침묵이 답입니다.",
    tags: ["침묵의날", "깊이", "기다림"],
  },
};

const LUCK_BY_JI: Record<string, { color: string; nums: string; dir: string; food: string }> = {
  자: { color: "짙은 남색", nums: "1 · 6", dir: "북쪽", food: "따뜻한 국물" },
  축: { color: "황토색", nums: "2 · 8", dir: "북동쪽", food: "고소한 죽" },
  인: { color: "신록", nums: "3 · 8", dir: "동쪽", food: "나물 반찬" },
  묘: { color: "연분홍", nums: "3 · 4", dir: "동남쪽", food: "봄나물" },
  진: { color: "옥색", nums: "5 · 0", dir: "남동쪽", food: "맑은 차" },
  사: { color: "주홍", nums: "2 · 7", dir: "남쪽", food: "향신료 음식" },
  오: { color: "붉은 기운", nums: "7 · 9", dir: "남쪽", food: "따끈한 밥상" },
  미: { color: "밀색", nums: "5 · 2", dir: "남서쪽", food: "부드러운 디저트" },
  신: { color: "은백", nums: "4 · 9", dir: "서쪽", food: "맑은 국물" },
  유: { color: "진주빛", nums: "4 · 1", dir: "서북쪽", food: "담백한 요리" },
  술: { color: "적갈색", nums: "5 · 5", dir: "북서쪽", food: "든든한 한 끼" },
  해: { color: "보랏빛", nums: "6 · 1", dir: "북쪽", food: "따뜻한 차" },
};

export type TodayPublicIljin = {
  han: string;
  hangulName: string;
  msg: string;
  tags: [string, string, string];
};

export type TodayPublicLuck = {
  color: string;
  nums: string;
  dir: string;
  food: string;
};

export function getTodayPublicIljin(date: Date = new Date()): TodayPublicIljin {
  const { year, month, day } = getKstParts(date);
  const { gan, ji } = getDayGanji(year, month, day);
  const pack = BY_JI[ji] ?? BY_JI.해;
  return {
    han: `${toHanjaGan(gan)}${toHanjaJi(ji)}`,
    hangulName: `${gan}${ji}일`,
    msg: pack.msg,
    tags: pack.tags,
  };
}

export function getTodayPublicLuck(date: Date = new Date()): TodayPublicLuck {
  const { year, month, day } = getKstParts(date);
  const { ji } = getDayGanji(year, month, day);
  return LUCK_BY_JI[ji] ?? LUCK_BY_JI.해;
}
