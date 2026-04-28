import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const key = String(form.get("key") ?? "").trim();
  if (!key) return NextResponse.redirect(new URL("/admin#content", request.url));

  const supabase = supabaseServer();
  await supabase.from("characters").delete().eq("key", key);

  return NextResponse.redirect(new URL("/admin#content", request.url));
}

