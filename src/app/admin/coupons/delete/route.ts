import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  if (!id) return NextResponse.redirect(new URL("/admin#commerce", request.url), 303);
  await supabaseServer().from("coupons").delete().eq("id", id);
  return NextResponse.redirect(new URL("/admin#commerce", request.url), 303);
}

