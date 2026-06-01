import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { revalidateReviewPages } from "@/lib/reviews-revalidate";
import { supabaseServer } from "@/lib/supabase/server";

function wantsJson(form: FormData, request: Request): boolean {
  return (
    String(form.get("ajax") ?? "") === "1" ||
    request.headers.get("accept")?.includes("application/json") === true
  );
}

export async function POST(request: Request) {
  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  const json = wantsJson(form, request);

  if (!(await isAdminRequest())) {
    if (json) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  if (!id) {
    if (json) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
    return NextResponse.redirect(new URL("/admin#reviews", request.url), 303);
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("reviews").delete().eq("id", id);

  if (error) {
    if (json) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.redirect(new URL("/admin#reviews", request.url), 303);
  }

  revalidateReviewPages();

  if (json) return NextResponse.json({ ok: true });

  return NextResponse.redirect(new URL("/admin#reviews", request.url), 303);
}
