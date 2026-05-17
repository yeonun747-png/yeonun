import { NextResponse } from "next/server";

import { listLinkedSocialAccounts } from "@/lib/auth/social-user-service";
import { requireMyUserId } from "@/lib/my-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  try {
    const accounts = await listLinkedSocialAccounts(auth.userId);
    return NextResponse.json({ ok: true, accounts });
  } catch (e) {
    console.error("[me/social/accounts]", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
