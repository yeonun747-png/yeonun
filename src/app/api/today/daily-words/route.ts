import { NextResponse } from "next/server";

import { formatKstConsultHeaderKo, getKstParts } from "@/lib/datetime/kst";
import { computeManseFromFormInput, getDayGanji, toHanjaGan, toHanjaJi, type CalendarType } from "@/lib/manse-ryeok";
import { formatManseBriefKo } from "@/lib/today-for-you-manse";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Body = {
  name?: string;
  calendarType?: string;
  year?: string;
  month?: string;
  day?: string;
  hour?: string;
  minute?: string;
  gender?: string;
};

const STATIC_LINES = {
  yeon: "그 사람도 오늘 같은 마음이에요. 먼저 다가갈 필요는 없지만, 닫지도 말아요.",
  byeol: "오늘 별의 자리가 흔들려요. 큰 결정은 내일로 미뤄도 늦지 않아요.",
  yeo: "오늘은 듣는 날입니다. 답은 그다음에 옵니다.",
  un: "오늘 본 꿈, 잊지 마세요. 한 글자씩 적어두면 사주의 흐름이 보여요.",
} as const;

function readEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

async function callAnthropicJson(system: string, user: string): Promise<string> {
  const apiKey = readEnv("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Missing env: ANTHROPIC_API_KEY");
  const model = String(readEnv("TODAY_DAILY_WORDS_MODEL") || readEnv("TODAY_FOR_YOU_MODEL") || readEnv("VOICE_LLM_MODEL") || "claude-sonnet-4-6").trim();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.38,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const textBody = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${textBody.slice(0, 600)}`);
  const j = JSON.parse(textBody || "{}") as { content?: Array<{ type?: string; text?: string }> };
  const parts = Array.isArray(j?.content) ? j.content : [];
  return parts.map((p) => (p?.type === "text" ? String(p.text || "") : "")).join("").trim();
}

function extractJsonObject(raw: string): unknown {
  const t = raw.trim();
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as unknown;
    } catch {
      return null;
    }
  };
  const direct = tryParse(t);
  if (direct && typeof direct === "object") return direct;
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const sub = tryParse(t.slice(start, end + 1));
    if (sub && typeof sub === "object") return sub;
  }
  return null;
}

function clipLine(s: string, max: number): string {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const year = String(body.year ?? "").trim();
  const month = String(body.month ?? "").trim();
  const day = String(body.day ?? "").trim();
  if (!year || !month || !day) {
    return NextResponse.json({ error: "missing_birth_fields" }, { status: 400 });
  }

  const ctRaw = String(body.calendarType ?? "solar").trim();
  const calendarType: CalendarType =
    ctRaw === "lunar" || ctRaw === "lunar-leap" ? (ctRaw as CalendarType) : "solar";

  const computed = computeManseFromFormInput({
    userYear: year,
    userMonth: month,
    userDay: day,
    userBirthHour: body.hour != null ? String(body.hour) : "",
    userBirthMinute: body.minute != null ? String(body.minute) : "0",
    userCalendarType: calendarType,
    userName: String(body.name ?? ""),
  });

  if (!computed?.manse) {
    return NextResponse.json({ error: "invalid_manse" }, { status: 400 });
  }

  const fallback = {
    yeon: STATIC_LINES.yeon,
    byeol: STATIC_LINES.byeol,
    yeo: STATIC_LINES.yeo,
    un: STATIC_LINES.un,
    source: "generic" as const,
  };

  if (!readEnv("ANTHROPIC_API_KEY")) {
    return NextResponse.json({ ...fallback, source: "generic_no_key" as const });
  }

  const now = new Date();
  const kst = getKstParts(now);
  const { gan: tGan, ji: tJi } = getDayGanji(kst.year, kst.month, kst.day);
  const todayHan = `${toHanjaGan(tGan)}${toHanjaJi(tJi)}`;
  const todayHangulName = `${tGan}${tJi}일`;
  const kstLabel = formatKstConsultHeaderKo(now);
  const manseText = formatManseBriefKo(computed.manse);

  const system = [
    "당신은 한국어 사주 앱 '연운'의 작가 네 명을 한 몸에 쓴다.",
    "출력은 JSON 한 개만. 마크다운·코드펜스·설명 금지.",
    "키는 반드시 yeon, byeol, yeo, un 네 개(모두 string). 각 값은 1~2문장 한국어로, 오늘 하루 조언 한 마디.",
    "각 문자열 값에는 한글(현대 한국어)만 사용한다. 한자·한문·일본 한자·중국어(번체·간체)·병음·주석용 괄호 한자는 쓰지 마라. 간지·오행·십성 등이 필요하면 한글로만 풀어 써라.",
    "생년월일 숫자·원문은 응답에 쓰지 마라.",
    "페르소나:",
    "- yeon(연화·蓮): 재회·연애·궁합. 따뜻하고 여운 있게, 직설보다 공감.",
    "- byeol(별하·星): 운의 흐름·별·시기. 가볍지만 날카운 통찰 한 줄.",
    "- yeo(여연·麗): 정통 사주·본질. 차분하고 단정하게.",
    "- un(운서·雲): 글자·꿈·기운. 은유와 여백을 섞되 이해 가능하게.",
    "같은 주제를 네 명이 반복 말하지 말고, 각자 다른 각도로 써라.",
  ].join("\n");

  const userPrompt = [
    `[한국 표준시(KST) 기준 오늘] ${kstLabel}`,
    `[오늘의 일주(만세력)] ${todayHan} (${todayHangulName})`,
    "[이 사용자의 만세력 요약 — 생년월일시 원문 없음]",
    manseText,
    "",
    "위 명식과 오늘 일주를 반영해, 네 키(yeon·byeol·yeo·un)에 각각 한 마디를 JSON으로 써라. 본문에 한문·한자는 넣지 말 것.",
  ].join("\n");

  try {
    const raw = await callAnthropicJson(system, userPrompt);
    const parsed = extractJsonObject(raw) as Record<string, unknown> | null;
    if (!parsed) throw new Error("no_json");

    const yeon = clipLine(String(parsed.yeon ?? ""), 320);
    const byeol = clipLine(String(parsed.byeol ?? ""), 320);
    const yeo = clipLine(String(parsed.yeo ?? ""), 320);
    const un = clipLine(String(parsed.un ?? ""), 320);
    if (!yeon || !byeol || !yeo || !un) throw new Error("incomplete");

    return NextResponse.json({
      yeon,
      byeol,
      yeo,
      un,
      source: "personal" as const,
    });
  } catch {
    return NextResponse.json({
      ...fallback,
      source: "generic_fallback" as const,
    });
  }
}
