import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("characters")
    .select("key,name,han,en,spec,greeting")
    .order("key");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

