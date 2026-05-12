import { NextResponse } from "next/server";

import { normalizeOpenAiRealtimeVoice } from "@/lib/openai-realtime-voices";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["yeon", "byeol", "yeo", "un"]);
const MAX_LEN = 600;

const voiceMemo = new Map<string, { external_id: string; provider: string; at: number }>();
const VOICE_MEMO_MS = 10 * 60 * 1000;

function pickVoiceFromRow(data: unknown): { external_id: string; provider: string } {
  const row = data as {
    tts_voices?: { external_id?: string; provider?: string } | { external_id?: string; provider?: string }[] | null;
  } | null;
  const v = row?.tts_voices;
  const cell = Array.isArray(v) ? v[0] : v;
  return {
    external_id: String(cell?.external_id ?? "").trim(),
    provider: String(cell?.provider ?? "cartesia").trim() || "cartesia",
  };
}

async function resolveVoice(character_key: string): Promise<{ external_id: string; provider: string } | null> {
  const now = Date.now();
  const hit = voiceMemo.get(character_key);
  if (hit && now - hit.at < VOICE_MEMO_MS) {
    return { external_id: hit.external_id, provider: hit.provider };
  }

  const envDefault = String(process.env.CARTESIA_DEFAULT_VOICE_EXTERNAL_ID ?? "").trim();
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("character_mode_prompts")
    .select("tts_voices(external_id,provider)")
    .eq("character_key", character_key)
    .eq("mode", "voice")
    .maybeSingle();

  if (error) {
    if (envDefault) {
      voiceMemo.set(character_key, { external_id: envDefault, provider: "cartesia", at: now });
      return { external_id: envDefault, provider: "cartesia" };
    }
    return null;
  }

  const { external_id: ext, provider } = pickVoiceFromRow(data);
  const external_id = ext || envDefault;
  if (!external_id) return null;
  const prov = ext ? provider : "cartesia";
  voiceMemo.set(character_key, { external_id, provider: prov, at: now });
  return { external_id, provider: prov };
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

  const voice = await resolveVoice(character_key);

  if (!voice) {
    return NextResponse.json(
      {
        error: "no_voice_for_character",
        hint: "Configure character_mode_prompts (voice) tts_voice_id or CARTESIA_DEFAULT_VOICE_EXTERNAL_ID.",
      },
      { status: 400 },
    );
  }

  if (voice.provider === "openai_realtime") {
    const apiKey = String(process.env.OPENAI_API_KEY ?? "").trim();
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 501 });
    }
    const model = String(process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts").trim();
    const vid = normalizeOpenAiRealtimeVoice(voice.external_id);
    const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice: vid,
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

  const apiKey = String(process.env.CARTESIA_API_KEY ?? "").trim();
  if (!apiKey) {
    return NextResponse.json({ error: "CARTESIA_API_KEY is not configured" }, { status: 501 });
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
      voice: { mode: "id", id: voice.external_id },
      output_format: {
        container: "wav",
        encoding: "pcm_s16le",
        sample_rate: 24000,
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
