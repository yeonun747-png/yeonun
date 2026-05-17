import { NextResponse } from "next/server";

import { getAdminMemberFile } from "@/lib/admin-cs-member";
import { isLoggedInUserId } from "@/lib/credit-server";
import { isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const userId = new URL(request.url).searchParams.get("user_id")?.trim() ?? "";
  if (!isLoggedInUserId(userId)) {
    return NextResponse.json({ ok: false, error: "invalid_user_id" }, { status: 400 });
  }

  try {
    const file = await getAdminMemberFile(userId);
    return NextResponse.json({ ok: true, file });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    const status = msg === "invalid_user_id" ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
