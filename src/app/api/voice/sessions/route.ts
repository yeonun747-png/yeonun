import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { getCharacterModePrompt, getCharacterPersona, getServicePrompt } from "@/lib/data/characters";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    character_key?: string;
    user_ref?: string;
    summary?: string;
  };

  const character_key = String(body.character_key ?? "yeon").trim();
  const [commonPrompt, characterPrompt, persona] = await Promise.all([
    getServicePrompt("yeonun_common_system"),
    getCharacterModePrompt(character_key, "voice"),
    getCharacterPersona(character_key),
  ]);
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("voice_sessions")
    .insert({
      character_key,
      user_ref: body.user_ref ?? "guest",
      status: "active",
      summary: body.summary ?? null,
    })
    .select("id,status,started_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    success: true,
    session: data,
    prompt_context: {
      common_system_prompt: commonPrompt?.prompt ?? null,
      character_system_prompt: characterPrompt?.prompt ?? null,
      persona_snapshot: persona ?? null,
      cartesia_voice: characterPrompt?.tts_voice
        ? { external_id: characterPrompt.tts_voice.external_id, label: characterPrompt.tts_voice.label }
        : null,
    },
  });
}

