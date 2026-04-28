import { supabaseServer } from "@/lib/supabase/server";
import { cache } from "react";

export type Character = {
  key: string;
  name: string;
  han: string;
  en: string;
  spec: string;
  greeting: string;
};

export type CharacterSpecialty = {
  name: string;
  desc: string;
};

export type CharacterPersona = {
  character_key: string;
  color_hex: string | null;
  age_impression: string | null;
  voice_tone: string | null;
  honorific_style: string | null;
  field_core: string | null;
  emotional_distance: string | null;
  sentence_tempo: string | null;
  endings: string | null;
  specialties: CharacterSpecialty[];
  temperament: string | null;
  speech_style: string | null;
  emotion_style: string | null;
  strengths: string | null;
  keywords: string[];
  is_active: boolean;
};

export type ServicePrompt = {
  key: string;
  title: string;
  prompt: string;
  is_active: boolean;
};

export type CharacterModePromptMode = "voice" | "fortune_text";

export type CharacterModePrompt = {
  character_key: string;
  mode: CharacterModePromptMode;
  title: string;
  prompt: string;
  is_active: boolean;
  tts_voice_id: string | null;
  tts_voice?: { external_id: string; label: string } | null;
};

export async function getCharacters(): Promise<Character[]> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("characters")
    .select("key,name,han,en,spec,greeting")
    .order("key");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const getCharactersCached = cache(getCharacters);

export async function getCharacterPersonas(): Promise<CharacterPersona[]> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("character_personas")
    .select("character_key,color_hex,age_impression,voice_tone,honorific_style,field_core,emotional_distance,sentence_tempo,endings,specialties,temperament,speech_style,emotion_style,strengths,keywords,is_active")
    .order("character_key");
  if (error) return [];
  return (data ?? []) as CharacterPersona[];
}

export const getCharacterPersonasCached = cache(getCharacterPersonas);

export async function getCharacterPersona(key: string): Promise<CharacterPersona | null> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("character_personas")
    .select("character_key,color_hex,age_impression,voice_tone,honorific_style,field_core,emotional_distance,sentence_tempo,endings,specialties,temperament,speech_style,emotion_style,strengths,keywords,is_active")
    .eq("character_key", key)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as CharacterPersona | null;
}

export const getCharacterPersonaCached = cache(getCharacterPersona);

export async function getServicePrompt(key: string): Promise<ServicePrompt | null> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("service_prompts")
    .select("key,title,prompt,is_active")
    .eq("key", key)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as ServicePrompt | null;
}

export const getServicePromptCached = cache(getServicePrompt);

export async function getCharacterModePrompt(
  character_key: string,
  mode: CharacterModePromptMode,
): Promise<CharacterModePrompt | null> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("character_mode_prompts")
    .select("character_key,mode,title,prompt,is_active,tts_voice_id")
    .eq("character_key", character_key)
    .eq("mode", mode)
    .maybeSingle();
  if (error) return null;
  const row = data as CharacterModePrompt | null;
  if (!row?.tts_voice_id) return row;

  const { data: voice } = await supabase
    .from("tts_voices")
    .select("external_id,label")
    .eq("id", row.tts_voice_id)
    .maybeSingle();
  return { ...row, tts_voice: voice ?? null };
}

export const getCharacterModePromptCached = cache(getCharacterModePrompt);

