import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** 기본: Haiku 4.5 (3.5 Haiku 일부 계정에서 비활성/오류 시 폴백) */
const DEFAULT_SUMMARY_MODEL = "claude-haiku-4-5-20251001";
const FALLBACK_SUMMARY_MODEL = "claude-3-5-haiku-20241022";

function stripHtml(html: string): string {
  return String(html ?? "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAssistantText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const content = (data as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as { type?: string; text?: string };
    if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
  }
  return parts.join("");
}

/** API 실패 시에도 음성 상담 맥락용 — 원문 길이의 약 10%만큼 앞부분 전달 */
function fallbackSummaryFromPlain(plain: string): string {
  const t = plain.replace(/\s+/g, " ").trim();
  const cap = Math.max(200, Math.round(t.length * 0.1));
  if (t.length <= cap) return t;
  return `${t.slice(0, cap)}… (점사 본문 앞부분만 전달)`;
}

/** 점사 평문 글자 수(공백 포함) 기준 약 8~12% 띠(중심 10%) */
function voiceSummaryTargetBand(sourceCharCount: number): { target: number; low: number; high: number } {
  const n = Math.max(1, sourceCharCount);
  const target = Math.min(n, Math.round(n * 0.1));
  const low = Math.min(target, Math.round(n * 0.08));
  const high = Math.min(Math.max(Math.round(n * 0.12), target), 12_000);
  return { target: Math.max(1, target), low: Math.max(1, low), high: Math.max(target, high) };
}

async function callAnthropicSummarize(
  apiKey: string,
  model: string,
  userBody: string,
  maxTokens: number,
): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.3,
      system:
        "당신은 연운(緣運) 사주 앱의 요약 전용 도우미입니다. 제공된 텍스트만 근거로 요약합니다.",
      messages: [{ role: "user", content: userBody }],
    }),
  });
  const rawText = await res.text().catch(() => "");
  if (!res.ok) {
    return { ok: false, status: res.status, body: rawText.slice(0, 2_000) };
  }
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    return { ok: false, status: 502, body: "invalid JSON from Anthropic" };
  }
  const text = extractAssistantText(data).trim();
  if (!text) {
    return { ok: false, status: 502, body: rawText.slice(0, 800) || "empty assistant text" };
  }
  return { ok: true, text };
}

/**
 * 음성 상담 시스템 프롬프트용 — Claude Haiku로 점사 본문 요약 (비스트림).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { html?: string };
  const raw = typeof body.html === "string" ? body.html : "";
  const plain = stripHtml(raw);
  if (!plain || plain.length < 20) {
    return NextResponse.json({ error: "html content too short after strip" }, { status: 400 });
  }

  const apiKey = String(process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const primaryModel = String(process.env.FORTUNE_VOICE_SUMMARY_MODEL ?? DEFAULT_SUMMARY_MODEL).trim();
  const trimmed = plain.length > 48_000 ? `${plain.slice(0, 48_000)}…` : plain;
  const sourceLen = trimmed.length;
  const { target, low, high } = voiceSummaryTargetBand(sourceLen);
  /** 한글 요약 길이 대비 여유 토큰(대략 글자당 0.4~0.6 토큰 가정) */
  const maxTokens = Math.min(8_192, Math.max(1_024, Math.ceil(target * 2.2)));

  const user = [
    "아래는 사용자가 방금 받은 텍스트 점사(만세력·해석)이다.",
    "음성 상담에서 캐릭터가 바로 맥락을 잡을 수 있도록, 사실 추측 없이 **핵심만** 한국어로 요약하라.",
    `원문 길이(공백 포함)는 약 ${sourceLen}자이다. 요약 분량은 이 원문의 **약 10% 내외**로 맞춰라.`,
    `- 목표 분량: 대략 ${target}자 전후(허용 범위 약 ${low}~${high}자). 문장 수는 고정하지 말고 분량에 맞게 가변으로 써라.`,
    "출력은 불릿·번호 없이 본문만. 인사·메타 설명 금지.",
    "---",
    trimmed,
  ].join("\n");

  try {
    let result = await callAnthropicSummarize(apiKey, primaryModel, user, maxTokens);
    if (!result.ok && primaryModel !== FALLBACK_SUMMARY_MODEL) {
      result = await callAnthropicSummarize(apiKey, FALLBACK_SUMMARY_MODEL, user, maxTokens);
    }

    if (result.ok) {
      return NextResponse.json({ summary: result.text, degraded: false });
    }

    const degradedSummary = fallbackSummaryFromPlain(plain);
    return NextResponse.json({
      summary: degradedSummary,
      degraded: true,
      warning:
        "요약 API를 사용하지 못해 본문 일부를 그대로 넘깁니다. ANTHROPIC_API_KEY·모델 권한을 확인하세요.",
      upstream_status: result.ok ? undefined : (result as { status: number }).status,
      upstream_details: !result.ok ? (result as { body: string }).body.slice(0, 500) : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
