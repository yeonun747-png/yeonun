import { formatKstConsultHeaderKo, getKstParts } from "@/lib/datetime/kst";
import {
  calculateManseRyeok,
  computeManseFromFormInput,
  ohangHangulFromStemOrBranch,
  type CalendarType,
} from "@/lib/manse-ryeok";

/** `MySajuCardClient` STORAGE_KEY 와 동일 — lib 단독 상수로 두어 클라이언트 번들 의존 최소화 */
const YEONUN_SAJU_LS = "yeonun_saju_v1";

const CHAR_FIRST: Record<string, string> = {
  yeon: "연화",
  byeol: "별하",
  yeo: "여연",
  un: "운서",
};

/** 채팅 인사에 쓰는 캐릭터 전문 분야(한 줄) */
const CHARACTER_SPECIALTY: Record<string, string> = {
  yeon: "재회·연애·짝사랑·궁합·속궁합·미래 배우자",
  byeol: "자미두수·신년운세·세운 흐름",
  yeo: "정통 사주·평생운·대운·세운",
  un: "작명·택일·꿈해몽·글자 기운",
};

/** 사주가 있을 때, 전문 분야 관점 한 마디 */
const WITH_SAJU_TAIL: Record<string, string> = {
  yeon: "인연·거리감·마음의 움직임이 겹치는 지점부터 가볍게 짚어볼 수 있어요.",
  byeol: "숫자로 보이는 흐름과, 마음이 끌리는 방향이 어디로 겹치는지 같이 볼게요.",
  yeo: "만세력의 뼈(연·월·일·시)와 오늘 일진이 만나는 식으로 짧게 풀어볼게요.",
  un: "이름·날·꿈처럼 말과 기운이 엮인 질문이면 더 잘 따라갈 수 있어요.",
};

function normalizeKey(characterKey: string): keyof typeof CHARACTER_SPECIALTY {
  const k = String(characterKey ?? "").trim();
  if (k in CHARACTER_SPECIALTY) return k as keyof typeof CHARACTER_SPECIALTY;
  return "yeon";
}

function parseSajuJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (j && typeof j === "object") return j;
  } catch {
    // ignore
  }
  return null;
}

/** Claude 첫 인사용 — UI에 숨긴 user 턴에만 사용 */
export const CHAT_SESSION_OPENING_USER_PROMPT = `[연운 채팅 상담 — 세션 시작]
사용자가 막 이 캐릭터와의 채팅 창을 열었습니다. 시스템 프롬프트의「사용자 사주명식」이 채워져 있으면 반드시 참고하세요.

다음을 한국어 구어체로, 4~8문장 정도 한 덩어리로만 출력하세요(이 지시문은 출력하지 마세요).
1) 짧게 인사하고 캐릭터로서 자신을 소개
2) 제 전문분야는 ○○입니다 — 캐릭터에 맞는 구체 키워드(예: 재회·연애·짝사랑·궁합 등)를 나열
3) 사주명식이 있으면: KST 오늘 날짜 맥락에서 일간·오늘 일진을 아주 짧게 한두 문장만 짚기(의학·법률 단정·과한 공포 금지)
4) 사주가 비어 있으면: 만남·마이에서 사주를 입력하면 반영된다고 한 줄 안내
5) 마지막은 무엇이 궁금한지 같이 알아보자는 식의 부드러운 질문으로 마무리`;

/** `yeonun_saju_v1` localStorage JSON (클라이언트 전용) */
export function readYeonunSajuJsonFromLocalStorage(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  return parseSajuJson(localStorage.getItem(YEONUN_SAJU_LS));
}

function calendarTypeFromJson(j: Record<string, unknown>): CalendarType {
  if (j.calendarType === "lunar-leap") return "lunar-leap";
  if (j.calendarType === "lunar") return "lunar";
  return "solar";
}

/**
 * 새 채팅 세션 첫 인사: 인사 + 전문 분야 + (사주 입력 시) 오늘 일진 맥락의 짧은 풀이 + 궁금한 점 초대.
 */
export function chatConsultOpeningFor(characterKey: string, sajuJson?: Record<string, unknown> | null): string {
  const key = normalizeKey(characterKey);
  const nick = CHAR_FIRST[key] ?? "연운";
  const spec = CHARACTER_SPECIALTY[key];
  const tail = WITH_SAJU_TAIL[key];
  const j = sajuJson ?? null;
  const y = j ? String(j.year ?? "").trim() : "";
  const mo = j ? String(j.month ?? "").trim() : "";
  const d = j ? String(j.day ?? "").trim() : "";
  const hasSaju = Boolean(y && mo && d);

  const invite = "무엇이 가장 궁금하세요? 같이 알아가 봐요.";

  if (!hasSaju) {
    return `안녕하세요, ${nick}예요. 제 전문분야는「${spec}」예요.\n\n지금 사주명식이 비어 있으면, 만남 탭이나 마이에서 입력해 두시면 이후 대화에 반영돼요.\n\n${invite}`;
  }

  const ho = j!.hour != null && String(j!.hour).trim() !== "" ? String(j!.hour).trim() : null;
  const mi = j!.minute != null && String(j!.minute).trim() !== "" ? String(j!.minute).trim() : null;
  const r = computeManseFromFormInput({
    userYear: y,
    userMonth: mo,
    userDay: d,
    userBirthHour: ho,
    userBirthMinute: mi,
    userCalendarType: calendarTypeFromJson(j!),
    userName: String(j!.name ?? ""),
  });

  if (!r) {
    return `안녕하세요, ${nick}예요. 제 전문분야는「${spec}」예요.\n\n사주 입력을 조금만 더 확인해 주시면, 명식 기준으로 같이 짚어볼게요.\n\n${invite}`;
  }

  const { manse } = r;
  const kst = getKstParts();
  const todayM = calculateManseRyeok(kst.year, kst.month, kst.day, 12, 0);
  const ilgan = manse.day.gan;
  const ilji = manse.day.ji;
  const oh = ohangHangulFromStemOrBranch(ilgan);
  const tg = todayM.day.gan;
  const tj = todayM.day.ji;
  const todayKo = formatKstConsultHeaderKo(new Date());

  return `안녕하세요, ${nick}예요. 제 전문분야는「${spec}」예요.\n\n입력해 둔 사주명식으로 보면 일간은 ${ilgan}(${oh}) · 일주는 ${ilgan}${ilji}예요. 한국 기준 오늘은 ${todayKo}이고, 오늘 일진은 ${tg}${tj}예요. ${tail}\n\n${invite}`;
}
