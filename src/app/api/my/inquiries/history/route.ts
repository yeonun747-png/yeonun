import { NextResponse } from "next/server";

import { requireMyUserId } from "@/lib/my-route-auth";
import { bearerFromRequest, supabaseRouteUserClient } from "@/lib/supabase/route-user-client";
import {
  countUnreadInquiryRepliesForUser,
  listMyInquiriesForUser,
  markInquiryReplyReadForUser,
} from "@/lib/user-inquiries-server";

export const dynamic = "force-dynamic";

async function myUserContext(request: Request): Promise<
  | { ok: true; userId: string; email: string | null }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth;

  const token = bearerFromRequest(request);
  const sbUser = token ? supabaseRouteUserClient(token) : null;
  let email: string | null = null;
  if (sbUser) {
    const { data } = await sbUser.auth.getUser();
    email = data.user?.email?.trim().toLowerCase() ?? null;
  }

  return { ok: true, userId: auth.userId, email };
}

export async function GET(request: Request) {
  const ctx = await myUserContext(request);
  if (!ctx.ok) return ctx.response;

  try {
    const [inquiries, unreadCount] = await Promise.all([
      listMyInquiriesForUser(ctx.userId, ctx.email),
      countUnreadInquiryRepliesForUser(ctx.userId, ctx.email),
    ]);
    return NextResponse.json({ ok: true, inquiries, unreadCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "list_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ctx = await myUserContext(request);
  if (!ctx.ok) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  try {
    const inquiry = await markInquiryReplyReadForUser(id, ctx.userId, ctx.email);
    const unreadCount = await countUnreadInquiryRepliesForUser(ctx.userId, ctx.email);
    return NextResponse.json({ ok: true, inquiry, unreadCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "read_failed";
    const status = msg === "forbidden" || msg === "invalid_id" ? 403 : msg === "not_found" ? 404 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
