import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { searchMembersForAdmin } from "@/lib/credit-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const members = await searchMembersForAdmin(q);
    return NextResponse.json({ ok: true, members });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "search_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
