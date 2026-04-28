import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { getCharacterModePrompt, getCharacterPersona, getServicePrompt } from "@/lib/data/characters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TurnBody = {
  text?: string;
  manse_context?: string;
  user_ref?: string;
};

function requiredEnv(name: string): string {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function callAnthropic(params: { system: string; user: string }) {
  const apiKey = requiredEnv("ANTHROPIC_API_KEY");
  const model = String(process.env.VOICE_LLM_MODEL || "claude-3-5-sonnet-20241022").trim();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      temperature: 0.5,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Anthropic error ${res.status}: ${t.slice(0, 500)}`);
  }

  const j = (await res.json().catch(() => null)) as any;
  const parts = Array.isArray(j?.content) ? j.content : [];
  const text = parts.map((p: any) => (p?.type === "text" ? String(p.text || "") : "")).join("").trim();
  return { text: text || "", model };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as TurnBody;
  const userText = String(body.text ?? "").trim();
  if (!userText) return NextResponse.json({ error: "text is required" }, { status: 400 });

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

  // 3) 사용자 턴 기록
  await supabase.from("voice_turns").insert({
    session_id: id,
    role: "user",
    text: userText,
  });

  // 4) LLM 호출
  let assistantText = "";
  let modelUsed: string | null = null;
  try {
    const out = await callAnthropic({ system, user: userText });
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

