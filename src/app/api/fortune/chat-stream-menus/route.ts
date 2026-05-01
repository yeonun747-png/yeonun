import { NextResponse } from "next/server";

import { fetchCloudwaysFortuneHtmlFromSse } from "@/lib/cloudways-fortune-one-shot";
import { normalizeCloudwaysBaseUrl } from "@/lib/cloudways-base-url";
import { getCharacterModePrompt, getServicePrompt } from "@/lib/data/characters";
import { getProductBySlug } from "@/lib/data/content";
import {
  buildClaudeFortunePromptPiecesSingleSubtitle,
  type ClaudeFortuneUserInfo,
} from "@/lib/fortune-claude-payload";
import { countHangulChars, type DemoProfile } from "@/lib/fortune-two-stage-demo";
import {
  buildFortuneMenuTocGroups,
  flattenFortuneMenuForStream,
  parseFortuneMenuJson,
} from "@/lib/product-fortune-menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Body = {
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

function normUser(u: Body["user_info"]): ClaudeFortuneUserInfo {
  return {
    name: String(u?.name ?? "연운").trim() || "연운",
    gender: String(u?.gender ?? "").trim(),
    birth_date: String(u?.birth_date ?? "").trim(),
    ...(u?.birth_hour != null && String(u.birth_hour).trim() !== ""
      ? { birth_hour: String(u.birth_hour).trim() }
      : {}),
  };
}

function encSse(obj: unknown) {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;

  const product_slug = String(body.product_slug ?? "").trim() || "demo";
  const profile: DemoProfile = body.profile === "pair" ? "pair" : "single";
  const character_key = String(body.character_key ?? "yeon").trim() || "yeon";
  const title = String(body.title ?? "풀이").trim() || "풀이";
  const manse_ryeok_text = String(body.manse_ryeok_text ?? "").trim();

  const product = await getProductBySlug(product_slug);
  if (!product) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 });
  }

  const menuParsed = parseFortuneMenuJson(product.fortune_menu);
  const flat = flattenFortuneMenuForStream(menuParsed);
  const tocGroups = buildFortuneMenuTocGroups(menuParsed);
  if (flat.length === 0) {
    return NextResponse.json({ error: "no_fortune_menus" }, { status: 404 });
  }

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
      { error: "CLOUDWAYS_URL is not configured" },
      { status: 501 },
    );
  }

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
    "HTML만 출력하고, 요청된 `subtitle-section` 구조를 따르세요.",
  ].join(" ");

  const user_info = normUser(body.user_info);
  const partner_info = profile === "pair" && body.partner_info ? normUser(body.partner_info) : null;

  const claudeModel =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : String(process.env.FORTUNE_CLOUDWAYS_MODEL ?? process.env.VOICE_LLM_MODEL ?? "claude-sonnet-4-6").trim() ||
        "claude-sonnet-4-6";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encSse(o));

      send({
        type: "meta",
        product_slug,
        profile,
        manse_context_included: manse_ryeok_text.length > 0,
        manse_context_chars: manse_ryeok_text.length,
      });

      send({
        type: "toc",
        sections: flat.map((s) => ({
          id: s.id,
          title: s.subtitle_title,
          main_title: s.main_title,
          ...(s.main_image_url ? { main_image_url: s.main_image_url } : {}),
          ...(s.main_video_thumb_url ? { main_video_thumb_url: s.main_video_thumb_url } : {}),
          ...(s.image_url ? { image_url: s.image_url } : {}),
          ...(s.video_thumb_url ? { video_thumb_url: s.video_thumb_url } : {}),
        })),
        toc_groups: tocGroups,
      });

      let totalChars = 0;
      for (let i = 0; i < flat.length; i++) {
        const sec = flat[i];
        const { system, user } = buildClaudeFortunePromptPiecesSingleSubtitle({
          role_prompt,
          restrictions,
          manse_ryeok_text,
          user_info,
          partner_info,
          profile,
          subtitle_title: sec.subtitle_title,
          interpretation_prompt: sec.interpretation_prompt,
        });

        send({ type: "section_start", index: i });
        try {
          const { html, streamError } = await fetchCloudwaysFortuneHtmlFromSse({
            cloudwaysUrl,
            cloudwaysSecret: cloudwaysSecret || undefined,
            system,
            user,
            model: claudeModel,
            onChunk: (delta) => {
              send({ type: "chunk", index: i, html: delta });
            },
          });
          if (streamError) {
            send({ type: "error", message: streamError });
          }
          const safe = html.trim() || "<div class=\"subtitle-section\"><h3 class=\"subtitle-title\"></h3><div class=\"subtitle-content\"><p>응답이 비었습니다.</p></div></div>";
          send({ type: "section_replace", index: i, html: safe });
          totalChars += Math.max(countHangulChars(safe), 1);
        } catch (e) {
          send({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
          const errHtml = `<div class="subtitle-section"><h3 class="subtitle-title">${sec.subtitle_title}</h3><div class="subtitle-content"><p>이 구간 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.</p></div></div>`;
          send({ type: "section_replace", index: i, html: errHtml });
          totalChars += 40;
        }
        send({ type: "section_end", index: i });
      }

      send({ type: "done", charCount: Math.max(totalChars, 120) });
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
