import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const type = String(form.get("type") ?? "amount").trim();
  const value = Number(String(form.get("value") ?? "0").trim());
  const max_uses_raw = String(form.get("max_uses") ?? "").trim();
  const is_active = String(form.get("is_active") ?? "false") === "true";

  if (!code || !Number.isFinite(value)) return NextResponse.redirect(new URL("/admin#commerce", request.url), 303);

  const payload = {
    code,
    type,
    value: Math.max(0, Math.round(value)),
    max_uses: max_uses_raw ? Math.max(0, Math.round(Number(max_uses_raw))) : null,
    is_active,
  };
  const supabase = supabaseServer();

  if (id) await supabase.from("coupons").update(payload).eq("id", id);
  else await supabase.from("coupons").upsert(payload, { onConflict: "code" });

  return NextResponse.redirect(new URL("/admin#commerce", request.url), 303);
}

