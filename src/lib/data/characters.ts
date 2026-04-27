import { supabaseServer } from "@/lib/supabase/server";

export type Character = {
  key: string;
  name: string;
  han: string;
  en: string;
  spec: string;
  greeting: string;
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

