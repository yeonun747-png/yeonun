import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { getCharacterModePrompt, getCharacterPersona, getServicePrompt } from "@/lib/data/characters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TurnBody = {
  text?: string;
  manse_context?: string;
  user_ref?: string;
  trigger?: "opening" | "user" | "silence";
  client_opening_text?: string;
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

function buildRecentTranscript(turns: Array<{ role: string | null; text: string | null }>): string {
  const lines: string[] = [];
  for (const t of turns) {
    const role = String(t.role ?? "").trim();
    const text = String(t.text ?? "").trim();
    if (!role || !text) continue;
    if (text === "__SILENCE_BREAK__") continue;
    const who = role === "assistant" ? "상담사" : role === "user" ? "사용자" : role;
    // 너무 긴 텍스트는 잘라 토큰 폭주를 막는다.
    const clipped = text.length > 900 ? `${text.slice(0, 900)}…` : text;
    lines.push(`${who}: ${clipped}`);
  }
  return lines.join("\n").trim();
}

async function updateMemorySummary(args: {
  supabase: ReturnType<typeof supabaseServer>;
  sessionId: string;
  prevSummary: string;
  recentTranscript: string;
  characterKey: string;
}) {
  const prev = String(args.prevSummary ?? "").trim();
  const recent = String(args.recentTranscript ?? "").trim();
  if (!recent) return;

  const summarySystem = [
    "당신은 상담 음성대화의 '메모리 요약기'입니다.",
    "목표: 다음 턴에서도 상담사가 맥락을 잃지 않도록 핵심 정보만 짧게 유지합니다.",
    "",
    "[규칙]",
    "- 한국어로만 작성",
    "- 길이: 6~12줄, 각 줄은 짧은 불릿('- ')",
    "- 포함: 사용자 상황/목표, 관계/사건 타임라인, 사용자가 말한 제약/선호, 상담사가 이미 한 약속/조언, 아직 답 못한 질문",
    "- 제외: 군더더기, 반복, 감정 과잉 묘사, '__SILENCE_BREAK__' 같은 제어 토큰",
    "- 반드시 사실 기반(추측 금지)",
  ].join("\n");

  const user = [
    prev ? `[이전 메모리]\n${prev}\n` : "",
    `[최근 대화]\n${recent}\n`,
    "[요청]\n이전 메모리를 최신 대화로 갱신해, 다음 턴에서도 맥락이 이어지도록 요약을 업데이트하세요.",
  ]
    .filter(Boolean)
    .join("\n");

  const out = await callAnthropic({ system: summarySystem, user, max_tokens: 320 });
  const nextSummary = String(out.text || "").trim();
  if (!nextSummary) return;
  await args.supabase
    .from("voice_sessions")
    .update({ memory_summary: nextSummary, memory_updated_at: new Date().toISOString() })
    .eq("id", args.sessionId);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as TurnBody;
  const trigger = body.trigger === "opening" ? "opening" : body.trigger === "silence" ? "silence" : "user";
  const userText = String(body.text ?? "").trim();
  if (trigger !== "opening" && !userText) return NextResponse.json({ error: "text is required" }, { status: 400 });

  // 1) 세션 조회 → 캐릭터 키 확인
  const supabase = supabaseServer();
  const { data: session, error: sessionError } = await supabase
    .from("voice_sessions")
    .select("id,character_key,status,memory_summary")
    .eq("id", id)
    .maybeSingle();
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session?.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.status && String(session.status) !== "active") {
    return NextResponse.json({ error: "Session is not active" }, { status: 409 });
  }

  const character_key = String(session.character_key ?? "yeon").trim() || "yeon";
  const memorySummary = String((session as any)?.memory_summary ?? "").trim();

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

  const baseSystem =
    String(commonPrompt?.prompt ?? "").trim() +
    "\n\n" +
    String(characterPrompt?.prompt ?? "").trim() +
    personaBlock +
    manseBlock +
    "\n\n[출력 규칙]\n- 한국어로만 답변\n- 4~8문장\n- 마지막은 짧은 질문 1개로 마무리";
  const system =
    trigger === "silence"
      ? `${baseSystem}\n\n[침묵 처리]\n사용자가 잠시 말이 없습니다. 부담 주지 말고 2~4문장으로 가볍게 흐름을 이어가고, 마지막은 예/아니오로 답할 수 있는 짧은 질문 1개로 마무리하세요.`
      : baseSystem;

  // NOTE: 오프닝은 사용자 체감 품질이 중요하므로 LLM을 건너뛰지 않는다.
  // (클라이언트 템플릿을 그대로 읽으면 유저 입장에서 의미가 없을 수 있음)

  // 3) 사용자 턴 기록 (opening은 사용자 발화가 없으므로 기록하지 않음)
  if (trigger !== "opening") {
    await supabase.from("voice_turns").insert({
      session_id: id,
      role: "user",
      text: userText,
    });
  }

  // 3.5) 최근 대화 기록을 불러와 "맥락"을 같이 제공한다.
  // 지금 입력까지 포함된 최근 턴을 가져오되, silence marker는 제외한다.
  const { data: recentTurnsRaw } = await supabase
    .from("voice_turns")
    .select("role,text,created_at")
    .eq("session_id", id)
    .order("created_at", { ascending: false })
    .limit(8);
  const recentTurns = Array.isArray(recentTurnsRaw) ? (recentTurnsRaw as any[]).reverse() : [];
  const transcript = buildRecentTranscript(recentTurns);

  // 4) LLM 호출
  let assistantText = "";
  let modelUsed: string | null = null;
  try {
    const baseUserPrompt =
      trigger === "opening"
        ? "사용자가 방금 입장했습니다. 먼저 인사하고, 본인의 주특기/상담 영역을 살려 만세력(있다면)을 근거로 2~3문장 정도의 첫 설명을 한 뒤, 지금 어떤 마음/상황으로 왔는지 짧은 질문 1개로 이어가세요."
        : trigger === "silence"
          ? "__SILENCE_BREAK__"
          : userText;

    const blocks: string[] = [];
    if (memorySummary) blocks.push(`[메모리 요약]\n${memorySummary}`);
    if (transcript) blocks.push(`[최근 대화]\n${transcript}`);
    blocks.push("[요청]\n위 맥락을 이어서 답변하세요.");
    blocks.push(`[이번 입력]\n${baseUserPrompt}`);
    const userPrompt = blocks.join("\n\n");
    // opening은 짧게 뽑아야 체감 지연이 줄어든다.
    // 체감 속도를 위해 user 턴도 과도하게 길게 생성하지 않는다.
    const maxTokens = trigger === "opening" ? 240 : trigger === "silence" ? 220 : 520;
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

  // 6) 메모리 요약 갱신 (긴 대화에서만, 비용/지연 최소화)
  // - sliding window(14행)만으로는 오래 대화하면 잘리므로, user 턴에서만 업데이트를 시도한다.
  // - 최근 로그가 충분히 쌓였을 때(14행 꽉 찼을 때)만 요약을 갱신한다.
  try {
    const recentLen = Array.isArray(recentTurnsRaw) ? recentTurnsRaw.length : 0;
    if (trigger === "user" && recentLen >= 8) {
      await updateMemorySummary({
        supabase,
        sessionId: id,
        prevSummary: memorySummary,
        recentTranscript: transcript,
        characterKey: character_key,
      });
    }
  } catch {
    // ignore memory update errors (non-blocking)
  }

  return NextResponse.json({ success: true, text: assistantText, model_used: modelUsed });
}

