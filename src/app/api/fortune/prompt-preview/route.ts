import { NextResponse } from "next/server";

import { getCharacterModePrompt, getServicePrompt } from "@/lib/data/characters";
import { buildClaudeFortunePromptPieces } from "@/lib/fortune-claude-payload";
import type { DemoProfile } from "@/lib/fortune-two-stage-demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PreviewBody = {
  product_slug?: string;
  profile?: string;
  character_key?: string;
  title?: string;
  manse_ryeok_text?: string;
  user_info?: {
    name?: string;
    gender?: string;
    birth_date?: string;
    birth_hour?: string;
  };
  partner_info?: {
    name?: string;
    gender?: string;
    birth_date?: string;
    birth_hour?: string;
  } | null;
};

function normUser(u: PreviewBody["user_info"]): {
  name: string;
  gender: string;
  birth_date: string;
  birth_hour?: string;
} {
  return {
    name: String(u?.name ?? "연운").trim() || "연운",
    gender: String(u?.gender ?? "").trim(),
    birth_date: String(u?.birth_date ?? "").trim(),
    ...(u?.birth_hour != null && String(u.birth_hour).trim() !== ""
      ? { birth_hour: String(u.birth_hour).trim() }
      : {}),
  };
}

function roughTokenEstimateFromChars(s: string): number {
  // 러프 추정: 한글/혼합 텍스트에서 보수적으로 1토큰≈3~4자 수준으로 가늠
  const n = Math.max(0, String(s ?? "").length);
  return Math.max(1, Math.round(n / 4));
}

export async function POST(request: Request) {
  // 기본은 막고, 필요한 경우에만 서버 env로 열어둔다.
  // (운영에서 실프롬프트 원문 노출은 위험할 수 있음)
  const allow = String(process.env.ALLOW_FORTUNE_PROMPT_PREVIEW || "").trim() === "1";
  if (!allow) {
    return NextResponse.json(
      { error: "Prompt preview is disabled", hint: "Set ALLOW_FORTUNE_PROMPT_PREVIEW=1 on the server to enable." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as PreviewBody;

  const product_slug = String(body.product_slug ?? "").trim() || "demo";
  const profile: DemoProfile = body.profile === "pair" ? "pair" : "single";
  const character_key = String(body.character_key ?? "yeon").trim() || "yeon";
  const title = String(body.title ?? "풀이").trim() || "풀이";
  const manse_ryeok_text = String(body.manse_ryeok_text ?? "").trim();
  const user_info = normUser(body.user_info);
  const partner_info = profile === "pair" && body.partner_info ? normUser(body.partner_info) : null;

  const [common, character] = await Promise.all([
    getServicePrompt("yeonun_fortune_text_system"),
    getCharacterModePrompt(character_key, "fortune_text"),
  ]);

  const charBlock = String(character?.prompt ?? "").trim();
  const commonBlock = String(common?.prompt ?? "").trim();
  const role_prompt = [
    charBlock,
    commonBlock ? `[공통 규칙 — 텍스트 점사형]\n${commonBlock}` : "",
    `맥락: 연운(緣運) 텍스트 점사. 상품 「${title}」(slug: ${product_slug}).`,
    "위에 [어조]·[말투]·캐릭터 규칙이 있으면, 아래 공통 규칙의 문체보다 항상 그것을 우선합니다. 건조한 명식 보고서체·호칭 일색으로만 쓰지 마세요.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const restrictions = [
    "제공된 만세력·명식 텍스트에 없는 생년·띠·출생지·임의 사실을 지어내지 마세요.",
    "HTML만 출력하고, 각 소제목은 요청된 `subtitle-section` 구조를 따르세요.",
  ].join(" ");

  const { system, user } = buildClaudeFortunePromptPieces({
    role_prompt,
    restrictions,
    manse_ryeok_text,
    user_info,
    partner_info,
    profile,
  });

  return NextResponse.json({
    product_slug,
    profile,
    character_key,
    title,
    pieces: {
      character_prompt: charBlock,
      common_prompt: commonBlock,
      role_prompt,
      restrictions,
      manse_ryeok_text,
      user_info,
      partner_info,
    },
    composed: {
      system,
      user,
      system_chars: system.length,
      user_chars: user.length,
      system_tokens_rough: roughTokenEstimateFromChars(system),
      user_tokens_rough: roughTokenEstimateFromChars(user),
      total_tokens_rough: roughTokenEstimateFromChars(system) + roughTokenEstimateFromChars(user),
    },
  });
}
