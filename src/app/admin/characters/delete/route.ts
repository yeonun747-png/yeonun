import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }
  const form = await request.formData();
  const key = String(form.get("key") ?? "").trim();
  if (!key) return NextResponse.redirect(new URL("/admin#content", request.url), 303);

  const supabase = supabaseServer();
  await supabase.from("characters").delete().eq("key", key);

  return NextResponse.redirect(new URL("/admin#content", request.url), 303);
}

