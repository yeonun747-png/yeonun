import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { listPendingInquiries, listRecentResolvedInquiries } from "@/lib/user-inquiries-server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const [pending, resolved] = await Promise.all([
    listPendingInquiries(100),
    listRecentResolvedInquiries(40),
  ]);

  return NextResponse.json({ ok: true, pending, resolved });
}
