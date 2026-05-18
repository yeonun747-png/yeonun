import { getCharacterModePrompt, getServicePrompt } from "@/lib/data/characters";
import { getProductBySlug } from "@/lib/data/content";
import {
  approxInputTokensKoreanHeavy,
  fortuneCachedSystemBlocks,
  padCacheableSystemTextToMinTokens,
} from "@/lib/fortune-claude-anthropic-cache";
import {
  buildFortuneMenuCachedSystemPlainText,
  buildFortuneMenuSectionUserMessage,
  type ClaudeFortuneUserInfo,
} from "@/lib/fortune-claude-payload";
import type { DemoProfile } from "@/lib/fortune-two-stage-demo";
import {
  buildFortuneMenuTocGroups,
  flattenFortuneMenuForStream,
  parseFortuneMenuJson,
} from "@/lib/product-fortune-menu";
import { hybridClaudeSectionCount, normalizeFortuneStreamStrategy } from "@/lib/fortune-stream-strategy";
import {
  filterTaekilMenuForPurpose,
  normalizeTaekilPurpose,
  TAEKIL_GOODDAY_SLUG,
  type PurposeType,
} from "@/lib/taekil-goodday";

export type FortuneMenuStreamClientBody = {
  product_slug?: string;
  profile?: string;
  character_key?: string;
  order_no?: string;
  title?: string;
  fortune_extra_context?: string;
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
  taekil_purpose?: string;
  taekil_period?: string;
  taekil_spouse_birth?: string;
};

export type FortuneMenuCloudwaysBody = Record<string, unknown>;

function normUser(u: FortuneMenuStreamClientBody["user_info"]): ClaudeFortuneUserInfo {
  return {
    name: String(u?.name ?? "연운").trim() || "연운",
    gender: String(u?.gender ?? "").trim(),
    birth_date: String(u?.birth_date ?? "").trim(),
    ...(u?.birth_hour != null && String(u.birth_hour).trim() !== ""
      ? { birth_hour: String(u.birth_hour).trim() }
      : {}),
  };
}

export type BuildFortuneMenuStreamResult =
  | { ok: true; upstream: FortuneMenuCloudwaysBody; product_slug: string; profile: DemoProfile }
  | { ok: false; status: number; error: string };

/** `POST /chat` 메뉴 점사 본문 — stream-session·stream-proxy·chat-stream-menus 공통 */
export async function buildFortuneMenuCloudwaysBody(
  body: FortuneMenuStreamClientBody,
): Promise<BuildFortuneMenuStreamResult> {
  const product_slug = String(body.product_slug ?? "").trim() || "demo";
  const profile: DemoProfile = body.profile === "pair" ? "pair" : "single";
  const character_key = String(body.character_key ?? "yeon").trim() || "yeon";
  const title = String(body.title ?? "풀이").trim() || "풀이";
  const manse_ryeok_text = String(body.manse_ryeok_text ?? "").trim();

  const product = await getProductBySlug(product_slug);
  if (!product) {
    return { ok: false, status: 404, error: "product_not_found" };
  }

  let menuParsed = parseFortuneMenuJson(product.fortune_menu);
  let taekilPurpose: PurposeType | null = null;
  if (product_slug === TAEKIL_GOODDAY_SLUG) {
    taekilPurpose =
      normalizeTaekilPurpose(body.taekil_purpose) ??
      (() => {
        const ctx = String(body.fortune_extra_context ?? "");
        const m = ctx.match(/선택한 목적:\s*\S+\s*\((\w+)\)/);
        return normalizeTaekilPurpose(m?.[1]);
      })();
    if (taekilPurpose) {
      menuParsed = filterTaekilMenuForPurpose(menuParsed, taekilPurpose);
    }
  }
  const flat = flattenFortuneMenuForStream(menuParsed);
  const tocGroups = buildFortuneMenuTocGroups(menuParsed);
  if (flat.length === 0) {
    return { ok: false, status: 404, error: "no_fortune_menus" };
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
    "본문은 한글·한자·필요한 영문·숫자만 사용하고, 키릴·아랍·태국어 등 다른 문자 체계는 절대 넣지 마세요.",
  ].join(" ");

  const user_info = normUser(body.user_info);
  const partner_info = profile === "pair" && body.partner_info ? normUser(body.partner_info) : null;
  const fortune_extra_context = String(body.fortune_extra_context ?? "").trim();

  const fortune_stream_strategy = normalizeFortuneStreamStrategy(product.fortune_stream_strategy);
  const hybrid_claude_section_count =
    fortune_stream_strategy === "hybrid" ? hybridClaudeSectionCount(menuParsed) : 0;

  const menuClaudeModel =
    String(process.env.FORTUNE_CLOUDWAYS_MODEL ?? process.env.VOICE_LLM_MODEL ?? "claude-sonnet-4-6").trim() ||
    "claude-sonnet-4-6";
  const menuGeminiModel =
    String(process.env.FORTUNE_MENU_GEMINI_MODEL ?? "gemini-2.5-pro").trim() || "gemini-2.5-pro";

  const tocSections = flat.map((s) => ({
    id: s.id,
    title: s.subtitle_title,
    main_title: s.main_title,
    ...(s.main_image_url ? { main_image_url: s.main_image_url } : {}),
    ...(s.main_video_thumb_url ? { main_video_thumb_url: s.main_video_thumb_url } : {}),
    ...(s.image_url ? { image_url: s.image_url } : {}),
    ...(s.video_thumb_url ? { video_thumb_url: s.video_thumb_url } : {}),
  }));

  const cachedPlain = buildFortuneMenuCachedSystemPlainText({ role_prompt, restrictions });
  const paddedCacheText = padCacheableSystemTextToMinTokens(cachedPlain);
  const fortune_menu_cached_system = fortuneCachedSystemBlocks(paddedCacheText);

  if (String(process.env.FORTUNE_CLAUDE_CACHE_LOG ?? "").trim() === "1") {
    console.log(
      `[fortune-claude-cache] sections=${flat.length} approx_tokens_plain=${approxInputTokensKoreanHeavy(cachedPlain)} approx_tokens_padded=${approxInputTokensKoreanHeavy(paddedCacheText)}`,
    );
  }

  const fortune_menu_sections = flat.map((sec) => ({
    user: buildFortuneMenuSectionUserMessage({
      manse_ryeok_text,
      user_info,
      partner_info,
      profile,
      subtitle_title: sec.subtitle_title,
      interpretation_prompt: sec.interpretation_prompt,
      ...(fortune_extra_context ? { fortune_extra_context } : {}),
    }),
    subtitle_title: sec.subtitle_title,
  }));

  const upstream: FortuneMenuCloudwaysBody = {
    fortune_menu_meta: {
      type: "meta",
      product_slug,
      profile,
      manse_context_included: manse_ryeok_text.length > 0,
      manse_context_chars: manse_ryeok_text.length,
      fortune_stream_strategy,
      hybrid_claude_section_count,
      ...(taekilPurpose ? { taekil_purpose: taekilPurpose } : {}),
    },
    fortune_menu_toc: {
      type: "toc",
      sections: tocSections,
      toc_groups: tocGroups,
    },
    fortune_menu_cached_system,
    fortune_menu_sections,
    model: menuClaudeModel,
    model_gemini_for_menu: menuGeminiModel,
  };

  return { ok: true, upstream, product_slug, profile };
}
