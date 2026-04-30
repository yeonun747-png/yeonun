import { NextResponse } from "next/server";

import { getCharacterModePrompt, getServicePrompt } from "@/lib/data/characters";
import { normalizeCloudwaysBaseUrl } from "@/lib/cloudways-base-url";
import { buildClaudeFortunePromptPieces } from "@/lib/fortune-jeminai-payload";
import type { DemoProfile } from "@/lib/fortune-two-stage-demo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ChatStreamBody = {
  product_slug?: string;
  profile?: string;
  character_key?: string;
  order_no?: string;
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
  model?: string;
};

function normUser(u: ChatStreamBody["user_info"]): {
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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ChatStreamBody;

  const cloudwaysUrl = normalizeCloudwaysBaseUrl(
    String(
      process.env.CLOUDWAYS_FORTUNE_URL ||
        process.env.CLOUDWAYS_URL ||
        process.env.NEXT_PUBLIC_CLOUDWAYS_URL ||
        "",
    ),
  );
  const cloudwaysSecret = String(process.env.CLOUDWAYS_PROXY_SECRET || "");

  if (!cloudwaysUrl) {
    return NextResponse.json(
      {
        error: "CLOUDWAYS_URL is not configured",
        hint: "Set CLOUDWAYS_FORTUNE_URL, CLOUDWAYS_URL, or NEXT_PUBLIC_CLOUDWAYS_URL to your Cloudways origin only (https://host, no /chat). Nginx proxies /chat to Node.",
      },
      { status: 501 },
    );
  }

  const product_slug = String(body.product_slug ?? "").trim() || "demo";
  const profile: DemoProfile = body.profile === "pair" ? "pair" : "single";
  const character_key = String(body.character_key ?? "yeon").trim() || "yeon";
  const title = String(body.title ?? "풀이").trim() || "풀이";
  const manse_ryeok_text = String(body.manse_ryeok_text ?? "").trim();

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

  const user_info = normUser(body.user_info);
  const partner_info = profile === "pair" && body.partner_info ? normUser(body.partner_info) : null;

  const claudeModel =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : String(process.env.FORTUNE_CLOUDWAYS_MODEL ?? process.env.VOICE_LLM_MODEL ?? "claude-sonnet-4-6").trim() ||
        "claude-sonnet-4-6";

  const { system, user } = buildClaudeFortunePromptPieces({
    role_prompt,
    restrictions,
    manse_ryeok_text,
    user_info,
    partner_info,
    profile,
  });

  const upstream = await fetch(`${cloudwaysUrl}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(cloudwaysSecret ? { Authorization: `Bearer ${cloudwaysSecret}` } : {}),
    },
    cache: "no-store",
    body: JSON.stringify({
      system,
      user,
      model: claudeModel,
      order_no: body.order_no ?? undefined,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const message = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "Cloudways /chat request failed", details: message.slice(0, 2000) },
      { status: upstream.status || 502 },
    );
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
