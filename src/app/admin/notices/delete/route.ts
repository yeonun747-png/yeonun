import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }
  const form = await request.formData();
  const slug = String(form.get("slug") ?? "").trim();
  if (slug) {
    const supabase = supabaseServer();
    await supabase.from("notices").delete().eq("slug", slug);
  }
  return NextResponse.redirect(new URL("/admin#notices", request.url), 303);
}
