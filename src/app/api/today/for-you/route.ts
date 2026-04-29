import { NextResponse } from "next/server";

import { formatKstConsultHeaderKo, getKstParts } from "@/lib/datetime/kst";
import { computeManseFromFormInput, getDayGanji, toHanjaGan, toHanjaJi, type CalendarType } from "@/lib/manse-ryeok";
import { formatManseBriefKo } from "@/lib/today-for-you-manse";
import { getTodayPublicIljin, getTodayPublicLuck } from "@/lib/today-kst-public";

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

function readEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

async function callAnthropicJson(system: string, user: string): Promise<string> {
  const apiKey = readEnv("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Missing env: ANTHROPIC_API_KEY");
  const model = String(readEnv("TODAY_FOR_YOU_MODEL") || readEnv("VOICE_LLM_MODEL") || "claude-sonnet-4-6").trim();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      temperature: 0.32,
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

function normalizeTags(arr: unknown): [string, string, string] {
  if (!Array.isArray(arr)) return ["오늘", "흐름", "마음"];
  const out = arr.map((x) => String(x ?? "").replace(/^#+/, "").trim()).filter(Boolean).slice(0, 3);
  while (out.length < 3) out.push("연운");
  return [out[0]!, out[1]!, out[2]!];
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

  const now = new Date();
  const kst = getKstParts(now);
  const { gan: tGan, ji: tJi } = getDayGanji(kst.year, kst.month, kst.day);
  const todayHan = `${toHanjaGan(tGan)}${toHanjaJi(tJi)}`;
  const todayHangulName = `${tGan}${tJi}일`;
  const kstLabel = formatKstConsultHeaderKo(now);
  const manseText = formatManseBriefKo(computed.manse);

  const genericIljin = getTodayPublicIljin(now);
  const genericLuck = getTodayPublicLuck(now);

  const fallback = {
    han: genericIljin.han,
    hangulName: genericIljin.hangulName,
    msg: genericIljin.msg,
    tags: genericIljin.tags,
    color: genericLuck.color,
    nums: genericLuck.nums,
    dir: genericLuck.dir,
    food: genericLuck.food,
    source: "generic" as const,
  };

  if (!readEnv("ANTHROPIC_API_KEY")) {
    return NextResponse.json({ ...fallback, source: "generic_no_key" as const });
  }

  const system = [
    "당신은 한국어 사주 앱 '연운'의 카피라이터다.",
    "출력은 반드시 JSON 한 개만. 마크다운·코드펜스·설명 문장 금지.",
    "키: msg (string, 1~2문장, 따옴표 없이 일반 문장), tags (string 배열 정확히 3개, 각각 # 없이 2~8자 한국어), color, nums, dir, food (모두 string).",
    "오늘의 일주(日干支) 한자·한글 일명은 사용자 입력이 아니라 서버가 준 고정값이므로 JSON에 넣지 마.",
    "생년월일 숫자를 응답에 쓰지 마. 만세력 요약과 오늘 일진의 관계만 반영해 오늘 하루 조언을 써라.",
  ].join("\n");

  const userPrompt = [
    `[한국 표준시(KST) 기준 오늘] ${kstLabel}`,
    `[오늘의 일주(만세력 고정)] ${todayHan} (${todayHangulName})`,
    `[사용자 사주 명식 요약 — 생년월일시 원문은 없음]`,
    manseText,
    "",
    "위 명식을 기준으로, 오늘의 일주가 이 사람에게 주는 기운을 반영해 msg·tags·오늘의 색·숫자 두 개(예: 3 · 7)·길한 방향(8방위 한국어)·길조 음식을 제안하라.",
  ].join("\n");

  try {
    const raw = await callAnthropicJson(system, userPrompt);
    const parsed = extractJsonObject(raw) as Record<string, unknown> | null;
    if (!parsed) throw new Error("no_json");

    const msg = String(parsed.msg ?? "").trim().slice(0, 220);
    const color = String(parsed.color ?? "").trim().slice(0, 24);
    const nums = String(parsed.nums ?? "").trim().slice(0, 16);
    const dir = String(parsed.dir ?? "").trim().slice(0, 16);
    const food = String(parsed.food ?? "").trim().slice(0, 24);
    const tags = normalizeTags(parsed.tags);

    if (!msg || !color || !nums || !dir || !food) {
      throw new Error("incomplete_fields");
    }

    return NextResponse.json({
      han: todayHan,
      hangulName: todayHangulName,
      msg,
      tags,
      color,
      nums,
      dir,
      food,
      source: "personal" as const,
    });
  } catch {
    return NextResponse.json({
      ...fallback,
      han: todayHan,
      hangulName: todayHangulName,
      source: "generic_fallback" as const,
    });
  }
}
