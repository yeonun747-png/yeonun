import { NextResponse } from "next/server";

import { normalizeOpenAiRealtimeVoice } from "@/lib/openai-realtime-voices";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["yeon", "byeol", "yeo", "un"]);
const MAX_LEN = 600;

const voiceMemo = new Map<string, { external_id: string; at: number }>();
const VOICE_MEMO_MS = 10 * 60 * 1000;

function pickVoiceFromRow(data: unknown): string {
  const row = data as {
    tts_voices?: { external_id?: string } | { external_id?: string }[] | null;
  } | null;
  const v = row?.tts_voices;
  const cell = Array.isArray(v) ? v[0] : v;
  return String(cell?.external_id ?? "").trim();
}

async function resolveVoiceExternalId(character_key: string): Promise<string | null> {
  const now = Date.now();
  const hit = voiceMemo.get(character_key);
  if (hit && now - hit.at < VOICE_MEMO_MS) {
    return hit.external_id;
  }

  const envDefault = String(process.env.OPENAI_DEFAULT_TTS_VOICE ?? "").trim();
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("character_mode_prompts")
    .select("tts_voices(external_id)")
    .eq("character_key", character_key)
    .eq("mode", "voice")
    .maybeSingle();

  if (error) {
    if (envDefault) {
      voiceMemo.set(character_key, { external_id: envDefault, at: now });
      return envDefault;
    }
    return null;
  }

  const external_id = pickVoiceFromRow(data) || envDefault;
  if (!external_id) return null;
  voiceMemo.set(character_key, { external_id, at: now });
  return external_id;
}

export async function POST(request: Request) {
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

  const voiceExternalId = await resolveVoiceExternalId(character_key);
  if (!voiceExternalId) {
    return NextResponse.json(
      {
        error: "no_voice_for_character",
        hint: "Configure character_mode_prompts (voice) tts_voice_id or OPENAI_DEFAULT_TTS_VOICE.",
      },
      { status: 400 },
    );
  }

  const apiKey = String(process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 501 });
  }

  const model = String(process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts").trim();
  const voice = normalizeOpenAiRealtimeVoice(voiceExternalId);
  const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input: transcript,
      format: "wav",
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "openai_speech_failed", details: detail.slice(0, 500) },
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
