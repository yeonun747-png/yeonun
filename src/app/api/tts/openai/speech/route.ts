import { NextResponse } from "next/server";

import { isAdminTtsPreviewAuthorized } from "@/lib/admin-tts-preview-token";
import { normalizeOpenAiRealtimeVoice } from "@/lib/openai-realtime-voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 어드민 전용: OpenAI Speech API 미리듣기(Realtime 보이스 id) */
export async function POST(request: Request) {
  if (!(await isAdminTtsPreviewAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = String(process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 501 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    voice?: string;
    input?: string;
  };
  const voice = normalizeOpenAiRealtimeVoice(body.voice);
  const input = String(body.input ?? "안녕하세요. 연운 음성 미리듣기입니다.").trim().slice(0, 600);

  const model = String(process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts").trim();

  const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input,
      format: "wav",
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "openai_speech_failed", details: detail.slice(0, 600) },
      { status: upstream.status || 502 },
    );
  }

  const buf = new Uint8Array(await upstream.arrayBuffer());
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "no-store",
    },
  });
}
