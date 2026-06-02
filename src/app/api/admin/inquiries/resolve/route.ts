import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { resolveUserInquiry } from "@/lib/user-inquiries-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    admin_reply?: string;
    reply?: string;
  };
  const id = String(body.id ?? "").trim();
  const adminReply = String(body.admin_reply ?? body.reply ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }
  if (!adminReply) {
    return NextResponse.json({ ok: false, error: "답변을 입력해 주세요." }, { status: 400 });
  }

  try {
    const inquiry = await resolveUserInquiry(id, adminReply);
    return NextResponse.json({ ok: true, inquiry });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "resolve_failed";
    const status =
      msg === "not_found" || msg === "invalid_id"
        ? 404
        : msg.includes("답변") || msg.includes("입력")
          ? 400
          : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
