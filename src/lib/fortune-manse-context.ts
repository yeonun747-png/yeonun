import { appendKstToManseContext } from "@/lib/datetime/kst";
import { computeManseFromFormInput, type CalendarType } from "@/lib/manse-ryeok";
import { PARTNER_HOUR_BRANCH_TO_CLOCK_HOUR } from "@/lib/partner-hour-branch";
import { readPartnerInfo, type PartnerInfoPayload } from "@/lib/partner-info-storage";

const PARTNER_RELATION_LABEL: Record<string, string> = {
  lover: "연인",
  crush: "썸·호감",
  spouse: "배우자",
  reunion: "재회 상대",
  friend: "친구",
  family_child: "가족·자녀",
  other: "기타",
};

function onePillarLine(p: {
  gan: string;
  ji: string;
  sibsung: string;
  jiSibsung: string;
  ohang: string;
  eumyang: string;
  sibiunsung: string;
  sibisinsal: string;
}) {
  return `${p.gan}${p.ji} · 십성 ${p.sibsung}/${p.jiSibsung} · 오행 ${p.ohang} · 음양 ${p.eumyang} · 운성 ${p.sibiunsung} · 신살 ${p.sibisinsal}`;
}

/** localStorage `yeonun_saju_v1` JSON → 만세력 블록 (Call DCC와 동일 구조) */
export function formatUserManseFromYeonunSajuJson(j: Record<string, unknown>): string {
  const cal =
    j.calendarType === "lunar-leap" ? "음력(윤)" : j.calendarType === "lunar" ? "음력" : "양력";
  const y = String(j.year ?? "").trim();
  const mo = String(j.month ?? "").trim();
  const d = String(j.day ?? "").trim();
  const ho = j.hour != null && String(j.hour).trim() !== "" ? String(j.hour).trim() : "";
  const mi = j.minute != null && String(j.minute).trim() !== "" ? String(j.minute).trim() : "";
  const birthLines = [
    `[본인 출생 입력]`,
    j.name ? `- 이름(기록용): ${String(j.name).trim()}` : null,
    `- 달력: ${cal}`,
    y && mo && d ? `- 생년월일: ${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}` : null,
    ho !== ""
      ? `- 출생 시각: ${ho}시 ${mi !== "" ? `${mi}분` : "(분 미입력)"}`
      : `- 출생 시각: 미입력(시주는 일간 기준 규칙에 따름)`,
  ]
    .filter(Boolean)
    .join("\n");

  const calType: CalendarType =
    j.calendarType === "lunar-leap" ? "lunar-leap" : j.calendarType === "lunar" ? "lunar" : "solar";

  const r = computeManseFromFormInput({
    userYear: y,
    userMonth: mo,
    userDay: d,
    userBirthHour: ho !== "" ? ho : null,
    userBirthMinute: mi !== "" ? mi : null,
    userCalendarType: calType,
    userName: String(j.name ?? ""),
  });

  if (!r) return birthLines;

  const m = r.manse;
  const lines = [
    `연주: ${onePillarLine(m.year)}`,
    `월주: ${onePillarLine(m.month)}`,
    `일주: ${onePillarLine(m.day)}`,
    `시주: ${onePillarLine(m.hour)}`,
  ].join("\n");
  return `${birthLines}\n\n[본인 만세력 사주 명식]\n${lines}`;
}

export function formatPartnerManseFromPayload(partner: PartnerInfoPayload): string {
  const rel = PARTNER_RELATION_LABEL[partner.relation] ?? partner.relation;
  const genderKo = partner.gender === "male" ? "남" : partner.gender === "female" ? "여" : "미입력";

  const birthLines = [
    `[상대방 출생 입력 (궁합)]`,
    partner.name.trim() ? `- 이름(기록용): ${partner.name.trim()}` : null,
    `- 관계: ${rel}`,
    `- 성별: ${genderKo}`,
    `- 양력 생년월일: ${partner.y}-${String(partner.m).padStart(2, "0")}-${String(partner.d).padStart(2, "0")}`,
    partner.unknownTime
      ? `- 출생 시각: 미입력 (시주는 풀이에서 제외)`
      : partner.hourBranch
        ? `- 출생 시각: 선택 시진 구간 (대표 시로 시주 산출)`
        : `- 출생 시각: 미선택`,
  ]
    .filter(Boolean)
    .join("\n");

  if (partner.unknownTime) {
    const r = computeManseFromFormInput({
      userYear: String(partner.y),
      userMonth: String(partner.m),
      userDay: String(partner.d),
      userBirthHour: null,
      userBirthMinute: null,
      userCalendarType: "solar",
      userName: partner.name,
    });
    if (!r) return birthLines;
    const m = r.manse;
    const lines = [
      `연주: ${onePillarLine(m.year)}`,
      `월주: ${onePillarLine(m.month)}`,
      `일주: ${onePillarLine(m.day)}`,
      `시주: (출생 시 미입력 — 시주 제외. 연·월·일주만 참고)`,
    ].join("\n");
    return `${birthLines}\n\n[상대방 만세력 사주 명식]\n${lines}`;
  }

  const hourKey = partner.hourBranch ?? "";
  const clockH = PARTNER_HOUR_BRANCH_TO_CLOCK_HOUR[hourKey];
  if (clockH === undefined) {
    return `${birthLines}\n\n[상대방 만세력] 시진 정보를 확인할 수 없어 명식을 산출하지 않았습니다.`;
  }

  const r = computeManseFromFormInput({
    userYear: String(partner.y),
    userMonth: String(partner.m),
    userDay: String(partner.d),
    userBirthHour: String(clockH),
    userBirthMinute: "0",
    userCalendarType: "solar",
    userName: partner.name,
  });

  if (!r) return birthLines;
  const m = r.manse;
  const lines = [
    `연주: ${onePillarLine(m.year)}`,
    `월주: ${onePillarLine(m.month)}`,
    `일주: ${onePillarLine(m.day)}`,
    `시주: ${onePillarLine(m.hour)}`,
  ].join("\n");
  return `${birthLines}\n\n[상대방 만세력 사주 명식]\n${lines}`;
}

/**
 * 브라우저에서만 호출. 본인(localStorage) + 궁합 시 상대(sessionStorage) 만세력을 합친 문자열.
 * `/api/fortune/stream` 의 `manse_context` 및 데모 스트림 메타에 동일 전달.
 */
export function buildFortuneManseContext(params: { profile: "single" | "pair"; productSlug: string }): string {
  if (typeof window === "undefined") return "";

  let userBlock = "";
  try {
    const raw = localStorage.getItem("yeonun_saju_v1");
    if (raw) {
      const j = JSON.parse(raw) as Record<string, unknown>;
      userBlock = formatUserManseFromYeonunSajuJson(j);
    }
  } catch {
    userBlock = "";
  }

  if (!userBlock.trim()) {
    userBlock = "[본인 출생 입력]\n- yeonun_saju_v1 에 저장된 사주가 없습니다. 내 사주 입력 후 다시 시도해 주세요.";
  }

  if (params.profile !== "pair") {
    return appendKstToManseContext(userBlock);
  }

  const partnerPayload = readPartnerInfo(params.productSlug);
  const partnerBlock = partnerPayload ? formatPartnerManseFromPayload(partnerPayload) : "";

  if (!partnerBlock.trim()) {
    return appendKstToManseContext(
      `${userBlock}\n\n---\n\n[상대방]\n- 상대방 정보가 session에 없습니다. (상대방 정보 없이 진행했거나 세션이 비어 있음)`,
    );
  }

  return appendKstToManseContext(`${userBlock}\n\n---\n\n${partnerBlock}`);
}
