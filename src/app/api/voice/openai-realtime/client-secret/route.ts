import { NextResponse } from "next/server";

import { getCharacterModePrompt, getCharacterPersona, getServicePrompt } from "@/lib/data/characters";
import {
  normalizeOpenAiRealtimeVoice,
  OPENAI_REALTIME_MODEL,
} from "@/lib/openai-realtime-voices";
import {
  VOICE_REALTIME_INSIGHT_TOOL_DEFINITION,
  VOICE_REALTIME_OPTIMIZATION_BLOCK,
  VOICE_REALTIME_RETENTION_BLOCK,
} from "@/lib/voice-realtime-insight-prompt";
import { buildUserHistoryContextBlock, fetchVoiceUserInsightsForContext } from "@/lib/voice-user-insights";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHARACTER_SPEC_KO: Record<string, string> = {
  yeon: "재회 · 연애 · 궁합",
  byeol: "자미두수 · 신년운세",
  yeo: "정통 사주 · 평생운",
  un: "작명 · 택일 · 꿈해몽",
};

/** OPENAI_REALTIME_INTERRUPT_RESPONSE 미지정 시 true — 바지인(말로 끊기) 허용. 오탐만 줄이려면 env에 false */
function envBool(raw: string | undefined, defaultValue: boolean): boolean {
  const t = String(raw ?? "").trim().toLowerCase();
  if (t === "true" || t === "1" || t === "yes" || t === "on") return true;
  if (t === "false" || t === "0" || t === "no" || t === "off") return false;
  return defaultValue;
}

/** Realtime audio.input: semantic VAD + (선택) 노이즈 감쇠로 VAD 오탐 완화 */
function buildRealtimeAudioInput(): Record<string, unknown> {
  const eagernessRaw = String(process.env.OPENAI_REALTIME_SEMANTIC_VAD_EAGERNESS ?? "").trim().toLowerCase();
  const eagernessOk = new Set(["low", "medium", "high", "auto"]);
  const eagerness = eagernessOk.has(eagernessRaw) ? eagernessRaw : "low";

  const interrupt_response = envBool(process.env.OPENAI_REALTIME_INTERRUPT_RESPONSE, true);

  const nrRaw = String(process.env.OPENAI_REALTIME_INPUT_NOISE_REDUCTION ?? "").trim().toLowerCase();
  let noise_reduction: { type: "near_field" | "far_field" } | undefined;
  if (nrRaw === "off" || nrRaw === "none" || nrRaw === "0") {
    noise_reduction = undefined;
  } else if (nrRaw === "near_field" || nrRaw === "far_field") {
    noise_reduction = { type: nrRaw };
  } else {
    noise_reduction = { type: "far_field" };
  }

  const input: Record<string, unknown> = {
    format: { type: "audio/pcm", rate: 24000 },
    turn_detection: {
      type: "semantic_vad",
      eagerness,
      interrupt_response,
    },
    transcription: { model: "gpt-4o-mini-transcribe", language: "ko" },
  };
  if (noise_reduction) input.noise_reduction = noise_reduction;
  return input;
}

type Body = {
  character_key?: string;
  session_id?: string;
  manse_context?: string;
};

function compactPersona(persona: Awaited<ReturnType<typeof getCharacterPersona>>): string {
  if (!persona) return "";
  const { specialties, keywords, ...rest } = persona;
  const core = { ...rest, specialties, keywords };
  try {
    return JSON.stringify(core).slice(0, 3500);
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const apiKey = String(process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY is not configured" }, { status: 501 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const character_key = String(body.character_key ?? "yeon").trim() || "yeon";
  const session_id = String(body.session_id ?? "").trim();
  const manse_context = String(body.manse_context ?? "").trim().slice(0, 8000);

  if (!session_id) {
    return NextResponse.json({ ok: false, error: "session_id is required" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: sess, error: sessErr } = await supabase
    .from("voice_sessions")
    .select("id,summary,character_key,status,user_ref")
    .eq("id", session_id)
    .maybeSingle();

  if (sessErr || !sess) {
    return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
  }
  if (String(sess.character_key ?? "").trim() !== character_key) {
    return NextResponse.json({ ok: false, error: "session_character_mismatch" }, { status: 403 });
  }
  if (String(sess.status ?? "") !== "active") {
    return NextResponse.json({ ok: false, error: "session_not_active" }, { status: 409 });
  }

  const [commonPrompt, characterPrompt, persona] = await Promise.all([
    getServicePrompt("yeonun_common_system"),
    getCharacterModePrompt(character_key, "voice"),
    getCharacterPersona(character_key),
  ]);

  const voiceId = normalizeOpenAiRealtimeVoice(
    characterPrompt?.tts_voice?.external_id ?? process.env.OPENAI_REALTIME_DEFAULT_VOICE ?? "marin",
  );

  const sessionSummary = String(sess.summary ?? "").trim();
  const specKo = CHARACTER_SPEC_KO[character_key] || "사주·운세 상담";
  const userRef = String(sess.user_ref ?? "").trim();

  const insightRows = await fetchVoiceUserInsightsForContext(supabase, userRef, character_key);
  const historyBlock = buildUserHistoryContextBlock(insightRows);
  const hasHistoryInsights = Boolean(historyBlock);

  const personaSnap = compactPersona(persona);
  const fortuneBlock = sessionSummary
    ? `[점사 직후 맥락·세션 입장 요약]\n${sessionSummary.slice(0, 8000)}\n\n위 맥락에 없는 사실은 지어내지 마세요.`
    : `사용자는 음성 상담 화면에 막 입장했습니다. 아직 긴 대화는 없습니다.`;

  const openingInstruction =
    sessionSummary && hasHistoryInsights
      ? `먼저 「점사 직후 맥락」을 한 문장으로 짚은 뒤, [User_History_Context]에 나온 과거 이야기 중 한 가지를 골라 따뜻하게 안부를 물으며 시작하세요. 이후 ${specKo} 톤으로 자연스럽게 이어가세요.`
      : sessionSummary
        ? `먼저 위 「점사 직후 맥락」을 한두 문장으로 짚으며 짧게 인사한 뒤, ${specKo} 톤으로 자연스럽게 이어가세요.`
        : hasHistoryInsights
          ? `[User_History_Context]를 참고해 재방문 인사 규칙에 따라 시작한 뒤, ${specKo} 톤으로 이어가세요.`
          : `짧게 인사한 뒤 ${specKo} 톤으로 부담 없는 질문 하나로 대화를 열어 주세요.`;

  const instructions = [
    String(commonPrompt?.prompt ?? "").trim(),
    String(characterPrompt?.prompt ?? "").trim(),
    personaSnap ? `[페르소나 스냅샷 JSON]\n${personaSnap}` : "",
    manse_context ? `[사용자 사주·출생 맥락]\n${manse_context}` : "",
    fortuneBlock,
    historyBlock,
    hasHistoryInsights ? VOICE_REALTIME_RETENTION_BLOCK : "",
    VOICE_REALTIME_OPTIMIZATION_BLOCK,
    `[역할]\n당신은 연운의 음성 상담 안내자입니다. 주특기 분야는 「${specKo}」입니다.`,
    `[출력·말하기 규칙]\n- 한국어 구어체로만 응답합니다.\n- 한 번에 길게 늘어놓지 말고 호흡을 끊어 말합니다.\n- AI·대규모언어모델임을 밝히지 않습니다.\n- 자해·법률·의학 확진 등은 안전하게 거절·안내합니다.`,
    `[도구]\n- 필요할 때만 save_user_insight를 호출해 사용자가 말한 사실을 기록합니다. 호출 후에는 대화를 자연스럽게 이어 가며, 저장했다고 굳이 말하지 않습니다.`,
    openingInstruction,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 32000);

  const sessionPayload = {
    session: {
      type: "realtime",
      model: OPENAI_REALTIME_MODEL,
      instructions,
      tools: [VOICE_REALTIME_INSIGHT_TOOL_DEFINITION],
      tool_choice: "auto",
      output_modalities: ["audio"],
      audio: {
        input: buildRealtimeAudioInput(),
        output: {
          format: { type: "audio/pcm", rate: 24000 },
          voice: voiceId,
        },
      },
    },
  };

  const upstream = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sessionPayload),
  });

  const raw = await upstream.text().catch(() => "");
  if (!upstream.ok) {
    return NextResponse.json(
      { ok: false, error: "openai_client_secret_failed", details: raw.slice(0, 800) },
      { status: upstream.status >= 400 ? upstream.status : 502 },
    );
  }

  let data: { value?: string; client_secret?: { value?: string } } = {};
  try {
    data = JSON.parse(raw || "{}") as typeof data;
  } catch {
    return NextResponse.json({ ok: false, error: "openai_client_secret_invalid_json" }, { status: 502 });
  }

  const value =
    String(data.value ?? "").trim() ||
    String((data as { client_secret?: { value?: string } }).client_secret?.value ?? "").trim();
  if (!value) {
    return NextResponse.json({ ok: false, error: "openai_client_secret_missing_value", details: raw.slice(0, 400) }, { status: 502 });
  }

  return NextResponse.json({
    ok: true as const,
    value,
    voice: voiceId,
    model: OPENAI_REALTIME_MODEL,
  });
}
