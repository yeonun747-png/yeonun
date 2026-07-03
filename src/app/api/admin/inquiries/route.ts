import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import {
  countPendingInquiries,
  listAdminInquiries,
  listPendingInquiries,
  listRecentResolvedInquiries,
  type AdminInquiryListTab,
  type AdminInquiryMemberFilter,
} from "@/lib/user-inquiries-server";

export const dynamic = "force-dynamic";

function parseTab(raw: string | null): AdminInquiryListTab {
  return raw === "resolved" ? "resolved" : "pending";
}

function parseMember(raw: string | null): AdminInquiryMemberFilter {
  if (raw === "member" || raw === "guest") return raw;
  return "all";
}

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tabParam = url.searchParams.get("tab");
  const mode = url.searchParams.get("mode");

  if (mode === "legacy" || (!mode && !tabParam)) {
    const [pending, resolved] = await Promise.all([listPendingInquiries(100), listRecentResolvedInquiries(40)]);
    return NextResponse.json({ ok: true, pending, resolved });
  }

  if (mode === "count") {
    const pendingCount = await countPendingInquiries();
    return NextResponse.json({ ok: true, pendingCount });
  }

  const tab = parseTab(url.searchParams.get("tab"));
  const member = parseMember(url.searchParams.get("member"));
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") ?? "30") || 30));
  const q = (url.searchParams.get("q") ?? "").replace(/,/g, " ").trim();

  const result = await listAdminInquiries({ tab, page, pageSize, q, member });
  const pendingCount = await countPendingInquiries();

  return NextResponse.json({ ok: true, ...result, pendingCount });
}
