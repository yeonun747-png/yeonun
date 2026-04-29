import { NextResponse } from "next/server";

import { getCharacterModePrompt } from "@/lib/data/characters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["yeon", "byeol", "yeo", "un"]);
const MAX_LEN = 600;

export async function POST(request: Request) {
  const apiKey = String(process.env.CARTESIA_API_KEY ?? "").trim();
  if (!apiKey) {
    return NextResponse.json({ error: "CARTESIA_API_KEY is not configured" }, { status: 501 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    character_key?: string;
    transcript?: string;
  };
  const character_key = String(body.character_key ?? "").trim();
  const transcriptRaw = String(body.transcript ?? "").trim();

  if (!ALLOWED.has(character_key)) {
    return NextResponse.json({ error: "invalid_character_key" }, { status: 400 });
  }
  const transcript = (transcriptRaw || "안녕하세요.").slice(0, MAX_LEN);

  const prompt = await getCharacterModePrompt(character_key, "voice");
  const voice_external_id =
    String(prompt?.tts_voice?.external_id ?? "").trim() ||
    String(process.env.CARTESIA_DEFAULT_VOICE_EXTERNAL_ID ?? "").trim();

  if (!voice_external_id) {
    return NextResponse.json(
      {
        error: "no_voice_for_character",
        hint: "Configure character_mode_prompts (voice) tts_voice_id or CARTESIA_DEFAULT_VOICE_EXTERNAL_ID.",
      },
      { status: 400 },
    );
  }

  const version = String(process.env.CARTESIA_API_VERSION || "2026-03-01").trim();
  const model_id = String(process.env.CARTESIA_TTS_MODEL || "sonic-2").trim();

  const upstream = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Cartesia-Version": version,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transcript,
      model_id,
      voice: { mode: "id", id: voice_external_id },
      output_format: {
        container: "wav",
        encoding: "pcm_s16le",
        sample_rate: 44100,
      },
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "cartesia_failed", details: detail.slice(0, 500) },
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
