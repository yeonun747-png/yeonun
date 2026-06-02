import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { mergeAuthAccountsForAdmin } from "@/lib/auth/social-user-service";
import { isLoggedInUserId } from "@/lib/credit-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    primary_user_id?: string;
    secondary_user_id?: string;
    memo?: string;
  };

  const primary = String(body.primary_user_id ?? "").trim();
  const secondary = String(body.secondary_user_id ?? "").trim();
  const memo = String(body.memo ?? "").trim();

  if (!isLoggedInUserId(primary) || !isLoggedInUserId(secondary)) {
    return NextResponse.json({ ok: false, error: "invalid_user_id" }, { status: 400 });
  }
  if (!memo) {
    return NextResponse.json({ ok: false, error: "memo_required" }, { status: 400 });
  }

  try {
    await mergeAuthAccountsForAdmin(primary, secondary, memo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "merge_failed" },
      { status: 500 },
    );
  }
}
