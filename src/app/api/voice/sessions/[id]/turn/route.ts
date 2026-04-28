import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { getCharacterModePrompt, getCharacterPersona, getServicePrompt } from "@/lib/data/characters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TurnBody = {
  text?: string;
  manse_context?: string;
  user_ref?: string;
  trigger?: "opening" | "user";
};

function requiredEnv(name: string): string {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function callAnthropic(params: { system: string; user: string; max_tokens: number }) {
  const apiKey = requiredEnv("ANTHROPIC_API_KEY");
  // 기본은 Claude 4.6 Sonnet 최신을 사용.
  // 배포 환경에서 모델명이 바뀌거나 권한이 없을 때 404가 날 수 있어, 아래에서 fallback 재시도를 한다.
  // Anthropic 최신 SDK 기준 모델명: "claude-sonnet-4-6" / "claude-opus-4-6"
  const primaryModel = String(process.env.VOICE_LLM_MODEL || "claude-sonnet-4-6").trim();
  const fallbackModels = [
    String(process.env.VOICE_LLM_MODEL_FALLBACK || "").trim(),
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-sonnet-latest",
    "claude-opus-latest",
  ].filter(Boolean);

  const tryOnce = async (model: string) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: Math.max(64, Math.min(1200, Math.floor(params.max_tokens))),
        temperature: 0.45,
        system: params.system,
        messages: [{ role: "user", content: params.user }],
      }),
    });
    const textBody = await res.text().catch(() => "");
    if (!res.ok) {
      // model not found 같은 케이스를 감지하기 위해 원문을 포함해 던진다.
      throw new Error(`Anthropic error ${res.status}: ${textBody.slice(0, 800)}`);
    }
    const j = (JSON.parse(textBody || "{}") as any) ?? {};
    const parts = Array.isArray(j?.content) ? j.content : [];
    const text = parts.map((p: any) => (p?.type === "text" ? String(p.text || "") : "")).join("").trim();
    return { text: text || "", model };
  };

  try {
    return await tryOnce(primaryModel);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 모델 미존재(404)면 fallback 모델들을 순서대로 재시도한다.
    if (/Anthropic error 404:/i.test(msg)) {
      for (const m of fallbackModels) {
        try {
          return await tryOnce(m);
        } catch {
          // try next
        }
      }
    }
    throw e;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as TurnBody;
  const trigger = body.trigger === "opening" ? "opening" : "user";
  const userText = String(body.text ?? "").trim();
  if (trigger !== "opening" && !userText) return NextResponse.json({ error: "text is required" }, { status: 400 });

  // 1) 세션 조회 → 캐릭터 키 확인
  const supabase = supabaseServer();
  const { data: session, error: sessionError } = await supabase
    .from("voice_sessions")
    .select("id,character_key,status")
    .eq("id", id)
    .maybeSingle();
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session?.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.status && String(session.status) !== "active") {
    return NextResponse.json({ error: "Session is not active" }, { status: 409 });
  }

  const character_key = String(session.character_key ?? "yeon").trim() || "yeon";

  // 2) 프롬프트 조립: 공통 + 캐릭터 + (페르소나/만세력)
  const [commonPrompt, characterPrompt, persona] = await Promise.all([
    getServicePrompt("yeonun_common_system"),
    getCharacterModePrompt(character_key, "voice"),
    getCharacterPersona(character_key),
  ]);

  const personaBlock = persona
    ? `\n\n[캐릭터 페르소나 스냅샷]\n${JSON.stringify(persona).slice(0, 3000)}`
    : "";
  const manseBlock = String(body.manse_context ?? "").trim()
    ? `\n\n[사용자 만세력/사주 명식]\n${String(body.manse_context).slice(0, 4000)}`
    : "";

  const system =
    String(commonPrompt?.prompt ?? "").trim() +
    "\n\n" +
    String(characterPrompt?.prompt ?? "").trim() +
    personaBlock +
    manseBlock +
    "\n\n[출력 규칙]\n- 한국어로만 답변\n- 4~8문장\n- 마지막은 짧은 질문 1개로 마무리";

  // 3) 사용자 턴 기록 (opening은 사용자 발화가 없으므로 기록하지 않음)
  if (trigger !== "opening") {
    await supabase.from("voice_turns").insert({
      session_id: id,
      role: "user",
      text: userText,
    });
  }

  // 4) LLM 호출
  let assistantText = "";
  let modelUsed: string | null = null;
  try {
    const userPrompt =
      trigger === "opening"
        ? "사용자가 방금 입장했습니다. 먼저 인사하고, 본인의 주특기/상담 영역을 살려 만세력(있다면)을 근거로 2~3문장 정도의 첫 설명을 한 뒤, 지금 어떤 마음/상황으로 왔는지 짧은 질문 1개로 이어가세요."
        : userText;
    // opening은 짧게 뽑아야 체감 지연이 줄어든다.
    const maxTokens = trigger === "opening" ? 240 : 800;
    const out = await callAnthropic({ system, user: userPrompt, max_tokens: maxTokens });
    assistantText = out.text || "";
    modelUsed = out.model;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "LLM request failed";
    // Anthropic 키 미설정이면 501로 명확히 표시
    if (/Missing env:\s*ANTHROPIC_API_KEY/i.test(msg)) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 501 });
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!assistantText) assistantText = "지금은 답변을 생성하지 못했어요. 한 번만 다시 말씀해주실래요?";

  // 5) 어시스턴트 턴 기록
  await supabase.from("voice_turns").insert({
    session_id: id,
    role: "assistant",
    text: assistantText,
  });

  return NextResponse.json({ success: true, text: assistantText, model_used: modelUsed });
}

