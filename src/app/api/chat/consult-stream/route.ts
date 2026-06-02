import { NextResponse } from "next/server";

import { getCharacterModePrompt, getCharacterPersona, getServicePrompt } from "@/lib/data/characters";
import {
  cachedSystemBlocks,
  padCacheableSystemTextToMinTokens,
} from "@/lib/claude-cache-system";
import { wrapAnthropicSseStreamWithCacheLogging } from "@/lib/claude-cache-logger";
import { buildRollingWindowAnthropicInput, type DialogTurnMsg } from "@/lib/dialog-window-claude";
import { logLlmErrorEvent } from "@/lib/llm-error-log";
import { CREDIT_CHAT_PER_USER_MESSAGE, gateConsultStream } from "@/lib/llm-stream-gate";
import { spendCredits } from "@/lib/credit-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PROMPT_CACHING_BETA = "prompt-caching-2024-07-31";

type Msg = { role: "user" | "assistant"; content: string };

type AnthropicMessage =
  | { role: "user" | "assistant"; content: string }
  | {
      role: "user";
      content: Array<{ type: "text"; text: string }>;
    };

function buildChatDynamicPrefix(manseBlock: string, systemAddendum: string): string {
  const parts = [manseBlock.trim()];
  const add = String(systemAddendum ?? "").trim();
  if (add) parts.push(`[대화 컨텍스트]\n${add}`);
  return parts.filter(Boolean).join("\n\n");
}

/** 동적 prefix는 마지막 user 턴(현재 입력)에만 붙임 */
function attachDynamicPrefixToLastUser(messages: DialogTurnMsg[], dynamicPrefix: string): AnthropicMessage[] {
  const out: AnthropicMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].role !== "user") continue;
    const userText = String(
      typeof out[i].content === "string" ? out[i].content : "",
    ).trim();
    out[i] = {
      role: "user",
      content: [
        { type: "text", text: dynamicPrefix },
        { type: "text", text: userText },
      ],
    };
    break;
  }
  return out;
}

export async function POST(request: Request) {
  const gate = await gateConsultStream(request);
  if (!gate.ok) return gate.response;

  if (gate.userId) {
    try {
      await spendCredits(gate.userId, CREDIT_CHAT_PER_USER_MESSAGE, {
        kind: "spend_chat",
        memo: "채팅 메시지",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "spend_failed";
      if (msg === "insufficient_credits") {
        return NextResponse.json({ error: msg }, { status: 402 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  const apiKey = String(process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 501 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    character_key?: string;
    messages?: Msg[];
    /** 클라이언트 `formatUserManseFromYeonunSajuJson` + KST 등 */
    manse_context?: string;
  };

  const character_key = String(body.character_key ?? "yeon").trim() || "yeon";
  const manseRaw = String(body.manse_context ?? "").trim();
  const history = Array.isArray(body.messages)
    ? (body.messages.filter((m) => m && (m.role === "user" || m.role === "assistant")) as DialogTurnMsg[])
    : [];
  if (history.length === 0) {
    return NextResponse.json({ error: "messages must include at least one turn" }, { status: 400 });
  }
  if (history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "last message must be from user" }, { status: 400 });
  }

  const [commonPrimary, commonLegacy, charChat, charVoice, persona] = await Promise.all([
    getServicePrompt("yeonun_chat_text_system").catch(() => null),
    getServicePrompt("yeonun_chat_system_common").catch(() => null),
    getCharacterModePrompt(character_key, "chat_text"),
    getCharacterModePrompt(character_key, "voice"),
    getCharacterPersona(character_key),
  ]);

  const commonBlock = String(commonPrimary?.prompt ?? commonLegacy?.prompt ?? "").trim();
  const charBlock = String(charChat?.prompt ?? charVoice?.prompt ?? "").trim();
  const personaBlock = persona
    ? `[캐릭터 페르소나]\n${[persona.temperament, persona.speech_style, persona.strengths].filter(Boolean).join("\n")}`
    : "";

  const manseBlock = manseRaw
    ? `[사용자 사주명식]\n${manseRaw.slice(0, 12_000)}`
    : "[사용자 사주명식]\n(미입력 — 사용자가 말한 범위 안에서만 다룹니다.)";

  const staticSystem = [
    commonBlock || "당신은 연운(緣運)의 채팅 상담자입니다. 한국어로 답합니다. 짧고 따뜻하게, 과장된 단정은 피합니다.",
    charBlock,
    personaBlock,
  ]
    .filter(Boolean)
    .join("\n\n");

  const rolled = await buildRollingWindowAnthropicInput({ apiKey, linearMessages: history });
  const dynamicPrefix = buildChatDynamicPrefix(manseBlock, rolled.systemAddendum);
  const anthropicMessages = attachDynamicPrefixToLastUser(rolled.messages, dynamicPrefix);

  const paddedStatic = padCacheableSystemTextToMinTokens(staticSystem);
  const system = cachedSystemBlocks(paddedStatic);

  const model = String(process.env.VOICE_LLM_MODEL ?? "claude-sonnet-4-6").trim() || "claude-sonnet-4-6";

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-beta": PROMPT_CACHING_BETA,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      temperature: 0.85,
      stream: true,
      system,
      messages: anthropicMessages,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    void logLlmErrorEvent("chat");
    const t = await upstream.text().catch(() => "");
    return NextResponse.json({ error: t.slice(0, 800) || "Anthropic stream failed" }, { status: upstream.status || 502 });
  }

  const loggedBody = wrapAnthropicSseStreamWithCacheLogging(upstream.body, "chat");

  return new NextResponse(loggedBody, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
