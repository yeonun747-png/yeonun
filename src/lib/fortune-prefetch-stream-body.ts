"use client";

import { partnerInfoFromPartnerStorage, readUserInfoFromYeonunSajuV1 } from "@/lib/fortune-claude-stream-user";
import { buildFortuneManseContext } from "@/lib/fortune-manse-context";
import { formatFortuneExtraForPrompt } from "@/lib/format-fortune-extra-for-prompt";
import { readFortuneExtraAnswers } from "@/lib/fortune-extra-input-storage";
import { getFortuneProductExtraConfig } from "@/lib/fortune-product-extra-config";
import type { FortuneMenuStreamClientBody } from "@/lib/fortune-menu-stream-payload";
import type { FortuneMenuStreamBody } from "@/lib/fortune-ux/fetchFortuneMenuStream";
import type { DemoProfile } from "@/lib/fortune-two-stage-demo";
import { readTaekilStreamBodyFields } from "@/lib/taekil-goodday";

export type BuildFortunePrefetchStreamBodyArgs = {
  productSlug: string;
  title: string;
  characterKey: string;
  profile: DemoProfile;
  orderNo?: string | null;
};

export function buildFortunePrefetchStreamBody(
  args: BuildFortunePrefetchStreamBodyArgs,
): FortuneMenuStreamBody & FortuneMenuStreamClientBody {
  const { productSlug, title, characterKey, profile, orderNo } = args;

  const manse_ryeok_text = buildFortuneManseContext({ profile, productSlug });
  const user_info = readUserInfoFromYeonunSajuV1();
  const partner_info = profile === "pair" ? partnerInfoFromPartnerStorage(productSlug) : null;

  const extraAnswers = readFortuneExtraAnswers(productSlug);
  const extraCfg = getFortuneProductExtraConfig(productSlug);
  const fortune_extra_context = (() => {
    if (!extraCfg) return "";
    return formatFortuneExtraForPrompt(extraCfg, extraAnswers).trim();
  })();

  return {
    product_slug: productSlug,
    profile,
    character_key: characterKey,
    order_no: orderNo ?? undefined,
    title,
    manse_ryeok_text,
    user_info,
    partner_info,
    ...(fortune_extra_context ? { fortune_extra_context } : {}),
    ...readTaekilStreamBodyFields(productSlug, extraAnswers),
  };
}
