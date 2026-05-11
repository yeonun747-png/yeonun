import { demoTocSections, type DemoProfile } from "@/lib/fortune-two-stage-demo";

/** Cloudways `POST /chat`·`/api/fortune/chat-stream` 의 `user_info` / `partner_info` 형태 */
export type ClaudeFortuneUserInfo = {
  name: string;
  gender: string;
  birth_date: string;
  birth_hour?: string;
};

function subtitleTool(title: string): string {
  return [
    `소제목「${title}」을 해석합니다.`,
    "반드시 HTML만 출력하세요.",
    "구조 예시:",
    `<div class="subtitle-section"><h3 class="subtitle-title">${title}</h3><div class="subtitle-content">…본문…</div></div>`,
    "문단 구분은 <p> 또는 <br> 로 표현하세요.",
  ].join(" ");
}

function buildClaudeFortuneUserBlock(input: {
  manse_ryeok_text: string;
  user_info: ClaudeFortuneUserInfo;
  partner_info?: ClaudeFortuneUserInfo | null;
  profile: DemoProfile;
}): string {
  const hasManse = Boolean(String(input.manse_ryeok_text ?? "").trim());
  return [
    "# 입력 데이터 (만세·명식 텍스트)",
    hasManse ? String(input.manse_ryeok_text).trim() : "(만세력 텍스트 없음)",
    "",
    hasManse
      ? "위 텍스트에 없는 생년·띠·출생지·임의 사실을 지어내지 마세요. 생년월일·생시는 보안상 본문에 없을 수 있으며, 만세력 텍스트만 근거로 삼으세요."
      : "만세력 데이터가 없으면 해석하지 말고, 데이터 부족만 짧게 안내하는 HTML 한 블록만 출력하세요.",
    "",
    "# 신청자",
    `- 표시 이름: ${input.user_info.name}`,
    input.user_info.gender ? `- 성별: ${input.user_info.gender}` : "",
    "",
    ...(input.profile === "pair" && input.partner_info
      ? [
          "# 상대(페어)",
          `- 표시 이름: ${input.partner_info.name}`,
          input.partner_info.gender ? `- 성별: ${input.partner_info.gender}` : "",
          "- 생년월일·생시는 보안상 제공되지 않을 수 있습니다.",
          "",
        ]
      : []),
    "내부적으로 명식 글자를 확인한 뒤, system에 지정된 HTML 구조로 해석을 작성하세요.",
    '"분석 대상 명식:" 같은 메타 문구는 출력하지 마세요.',
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * Cloudways `POST /chat` 이 기대하는(레거시 reunionf82 형) 본문을 만듭니다.
 * (연운 Next의 `/api/fortune/chat-stream`은 주로 `buildClaudeFortunePromptPieces`만 사용)
 */
export function buildClaudeFortuneChatBody(input: {
  role_prompt: string;
  restrictions: string;
  manse_ryeok_text: string;
  user_info: ClaudeFortuneUserInfo;
  partner_info?: ClaudeFortuneUserInfo | null;
  profile: DemoProfile;
  model?: string;
}): Record<string, unknown> {
  const sections = demoTocSections(input.profile);
  const menu_subtitles = sections.map((s) => ({
    subtitle: s.title,
    interpretation_tool: subtitleTool(s.title),
    char_count: 900,
  }));

  return {
    role_prompt: input.role_prompt,
    restrictions: input.restrictions,
    menu_subtitles,
    menu_items: [],
    user_info: input.user_info,
    ...(input.profile === "pair" && input.partner_info ? { partner_info: input.partner_info } : {}),
    model: input.model ?? "gemini-2.5-pro",
    manse_ryeok_text: input.manse_ryeok_text,
  };
}

/**
 * Next에서 Claude(Anthropic) 호출용 `system` / `user` 를 조립합니다.
 * Cloudways 장시간 스트림 서버는 이 두 필드만 받아 전달합니다.
 */
export function buildClaudeFortunePromptPieces(input: {
  role_prompt: string;
  restrictions: string;
  manse_ryeok_text: string;
  user_info: ClaudeFortuneUserInfo;
  partner_info?: ClaudeFortuneUserInfo | null;
  profile: DemoProfile;
  fortune_extra_context?: string;
}): { system: string; user: string } {
  const sections = demoTocSections(input.profile);
  const menu_subtitles = sections.map((s) => ({
    subtitle: s.title,
    interpretation_tool: subtitleTool(s.title),
    char_count: 900,
  }));

  const system = [
    "당신은 연운(緣運) 텍스트 점사를 맡은 한 역할입니다. 아래 role_prompt(캐릭터·공통)와 소제목 지침을 모두 따릅니다.",
    "",
    input.role_prompt.trim(),
    "",
    "[어조·말투]",
    "role_prompt 안의 [어조]·[말투]·편지체 등 캐릭터 지시는 본문 전체(모든 subtitle-section)에 일관되게 적용합니다. 공통 규칙과 충돌하면 캐릭터 어조를 우선합니다.",
    "",
    "[필수 주의]",
    input.restrictions.trim(),
    "",
    "출력은 한국어 HTML만 사용합니다. 마크다운 코드 펜스(```)로 감싸지 마세요.",
    "각 소제목은 반드시 다음 구조를 사용합니다:",
    '<div class="subtitle-section"><h3 class="subtitle-title">소제목 텍스트</h3><div class="subtitle-content">…</div></div>',
    "문단은 <p> 또는 <br> 로 구분합니다.",
    "",
    "# 소제목 목록 (순서대로 모두 작성)",
    ...menu_subtitles.flatMap((m, i) => [
      "",
      `## ${i + 1}. 「${m.subtitle}」`,
      m.interpretation_tool,
      `분량: 약 ${m.char_count}자 내외.`,
    ]),
    "",
    "한 번의 응답에 위 소제목을 빠짐없이 순서대로 모두 포함합니다.",
    "",
    "작성 직전 확인: 각 소제목 본문 문장이 role_prompt의 [어조]에 맞는지 다시 점검하세요.",
  ].join("\n");

  const userBlock = buildClaudeFortuneUserBlock({
    manse_ryeok_text: input.manse_ryeok_text,
    user_info: input.user_info,
    partner_info: input.partner_info,
    profile: input.profile,
  });
  const extra = String(input.fortune_extra_context ?? "").trim();
  const user =
    extra.length > 0
      ? [userBlock, "", "# 상품별 추가 입력 (해석에 반영)", extra].join("\n")
      : userBlock;

  return { system, user };
}

/**
 * 소메뉴 루프에서 요청마다 동일한 블록 — Claude `system`(prompt caching 대상)에만 넣습니다.
 * (role_prompt = DB 캐릭터·공통 지침 + `chat-stream-menus`에서 조립한 맥락)
 */
export function buildFortuneMenuCachedSystemPlainText(input: { role_prompt: string; restrictions: string }): string {
  return [
    "당신은 연운(緣運) 텍스트 점사를 맡은 한 역할입니다. 아래 role_prompt(캐릭터·공통)를 따릅니다.",
    "",
    input.role_prompt.trim(),
    "",
    "[어조·말투]",
    "role_prompt 안의 [어조]·[말투] 등 캐릭터 지시를 본문에 일관되게 적용합니다.",
    "",
    "[필수 주의]",
    input.restrictions.trim(),
    "",
    "출력은 한국어 HTML만 사용합니다. 마크다운 코드 펜스(```)로 감싸지 마세요.",
    "각 응답마다 사용자 메시지에 적힌 소제목·해석 지침에 맞춰 subtitle-section 한 블록만 출력합니다.",
    "구조: <div class=\"subtitle-section\"><h3 class=\"subtitle-title\">…</h3><div class=\"subtitle-content\">…</div></div>",
    "문단은 <p> 또는 <br> 로 구분합니다.",
    "사용자 메시지의 해석 지침·만세력 데이터만 근거로 삼고, 없는 사실을 지어내지 마세요.",
    "사용자 메시지에 명시된 h3 제목 텍스트를 바꾸지 마세요.",
  ].join("\n");
}

/** 소메뉴별 해석 지침 + 명식 데이터 — Claude `messages` user content */
export function buildFortuneMenuSectionUserMessage(input: {
  manse_ryeok_text: string;
  user_info: ClaudeFortuneUserInfo;
  partner_info?: ClaudeFortuneUserInfo | null;
  profile: DemoProfile;
  subtitle_title: string;
  interpretation_prompt: string;
  /** 상품별 추가 입력(꿈·상대 생일 등) — 모든 소메뉴 user에 동일하게 포함 */
  fortune_extra_context?: string;
}): string {
  const hasInterp = Boolean(input.interpretation_prompt.trim());
  const tool = [
    `이번 응답에서는 소제목「${input.subtitle_title}」만 해석합니다.`,
    hasInterp ? `운영자가 지정한 해석 지침:\n${input.interpretation_prompt.trim()}` : "",
    hasInterp
      ? "위 해석 지침에 적힌 분량·글자 수·범위가 있으면 그것을 우선합니다. 지침과 다른 고정 분량 규칙은 무시합니다."
      : "",
    "반드시 한국어 HTML만 출력하세요. 마크다운 코드 펜스(```)는 사용하지 마세요.",
    "반드시 다음 구조 한 덩어리만 출력합니다(앞뒤에 다른 소제목·서론을 붙이지 마세요):",
    `<div class="subtitle-section"><h3 class="subtitle-title">${input.subtitle_title}</h3><div class="subtitle-content">…본문…</div></div>`,
    "문단은 <p> 또는 <br> 로 구분합니다.",
    // 해석 지침이 비어 있을 때만 기본 분량 힌트 (메뉴 점사는 소메뉴별로 별도 호출되므로 고정 자수는 어드민 지침과 충돌하기 쉬움)
    hasInterp ? "" : "분량은 약 600~1200자 내외로 작성합니다.",
    "이번 응답에는 위에서 요청한 subtitle-section 한 블록만 출력합니다. h3 제목 텍스트를 바꾸지 마세요.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const dataBlock = buildClaudeFortuneUserBlock({
    manse_ryeok_text: input.manse_ryeok_text,
    user_info: input.user_info,
    partner_info: input.partner_info,
    profile: input.profile,
  });

  const extra = String(input.fortune_extra_context ?? "").trim();
  const extraBlock =
    extra.length > 0
      ? ["", "# 상품별 추가 입력 (해석에 반영)", extra].join("\n")
      : "";

  return ["# 이번 소제목 해석 요청", "", tool, "", "---", "", dataBlock, extraBlock].join("");
}

/** DB 소메뉴 1개에 대응하는 단일 `subtitle-section` Claude 프롬프트 (레거시·미리보기용 단일 문자열) */
export function buildClaudeFortunePromptPiecesSingleSubtitle(input: {
  role_prompt: string;
  restrictions: string;
  manse_ryeok_text: string;
  user_info: ClaudeFortuneUserInfo;
  partner_info?: ClaudeFortuneUserInfo | null;
  profile: DemoProfile;
  subtitle_title: string;
  interpretation_prompt: string;
}): { system: string; user: string } {
  const cachedSystemPlain = buildFortuneMenuCachedSystemPlainText({
    role_prompt: input.role_prompt,
    restrictions: input.restrictions,
  });
  const user = buildFortuneMenuSectionUserMessage({
    manse_ryeok_text: input.manse_ryeok_text,
    user_info: input.user_info,
    partner_info: input.partner_info,
    profile: input.profile,
    subtitle_title: input.subtitle_title,
    interpretation_prompt: input.interpretation_prompt,
  });
  return { system: cachedSystemPlain, user };
}
