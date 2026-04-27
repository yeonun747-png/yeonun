import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const supabase = supabaseServer();
  let q = supabase
    .from("products")
    .select("slug,title,quote,category_slug,badge,price_krw,character_key")
    .order("created_at", { ascending: false });

  if (category && category !== "all") {
    q = q.eq("category_slug", category);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

