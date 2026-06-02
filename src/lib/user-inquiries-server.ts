import { formatPhoneKrInput, phoneKrDigitCount } from "@/lib/format-phone-kr";
import { supabaseServer } from "@/lib/supabase/server";
import type {
  AdminMemberFileInquiryRow,
  MyInquiryListItem,
  UserInquiryRow,
} from "@/lib/user-inquiries-types";
import { isInquiryReplyUnread } from "@/lib/user-inquiries-types";

export type { AdminMemberFileInquiryRow, MyInquiryListItem, UserInquiryRow } from "@/lib/user-inquiries-types";
export { isInquiryReplyUnread };

export type CreateUserInquiryInput = {
  userId?: string | null;
  name: string;
  email: string;
  phone: string;
  body: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateInquiryInput(input: CreateUserInquiryInput): string | null {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = normalizePhone(input.phone);
  const body = input.body.trim();

  if (name.length < 1 || name.length > 40) return "이름을 입력해 주세요.";
  if (!EMAIL_RE.test(email) || email.length > 120) return "올바른 이메일을 입력해 주세요.";
  const phoneDigits = phoneKrDigitCount(phone);
  if (phoneDigits > 0 && (phoneDigits < 9 || phoneDigits > 11)) return "올바른 전화번호를 입력해 주세요.";
  if (body.length < 5 || body.length > 2000) return "문의 내용을 5자 이상 입력해 주세요.";
  return null;
}

export function validateAdminInquiryReply(raw: string): string | null {
  const reply = String(raw ?? "").trim();
  if (reply.length < 5 || reply.length > 4000) return "답변은 5자 이상 4,000자 이내로 입력해 주세요.";
  return null;
}

export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return formatPhoneKrInput(trimmed);
}

const INQUIRY_SELECT =
  "id,user_id,name,email,phone,body,status,created_at,resolved_at,resolved_by,admin_reply,reply_read_at";
const INQUIRY_SELECT_LEGACY =
  "id,user_id,name,email,phone,body,status,created_at,resolved_at,resolved_by";
const MY_INQUIRY_LIST_SELECT =
  "id,body,status,created_at,resolved_at,admin_reply,reply_read_at";
const MY_INQUIRY_LIST_SELECT_LEGACY = "id,body,status,created_at,resolved_at";

function isMissingInquiryReplyColumnError(error: { message?: string } | null): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  return msg.includes("admin_reply") || msg.includes("reply_read_at") || msg.includes("does not exist");
}

function normalizeMyInquiryListItem(raw: Record<string, unknown>): MyInquiryListItem {
  return {
    id: String(raw.id ?? ""),
    body: String(raw.body ?? ""),
    status: raw.status === "pending" ? "pending" : "resolved",
    created_at: String(raw.created_at ?? ""),
    resolved_at: raw.resolved_at ? String(raw.resolved_at) : null,
    admin_reply: raw.admin_reply != null ? String(raw.admin_reply) : null,
    reply_read_at: raw.reply_read_at != null ? String(raw.reply_read_at) : null,
  };
}

function normalizeUserInquiryRow(raw: Record<string, unknown>): UserInquiryRow {
  return {
    id: String(raw.id ?? ""),
    user_id: raw.user_id != null ? String(raw.user_id) : null,
    name: String(raw.name ?? ""),
    email: String(raw.email ?? ""),
    phone: String(raw.phone ?? ""),
    body: String(raw.body ?? ""),
    status: raw.status === "pending" ? "pending" : "resolved",
    created_at: String(raw.created_at ?? ""),
    resolved_at: raw.resolved_at ? String(raw.resolved_at) : null,
    resolved_by: raw.resolved_by != null ? String(raw.resolved_by) : null,
    admin_reply: raw.admin_reply != null ? String(raw.admin_reply) : null,
    reply_read_at: raw.reply_read_at != null ? String(raw.reply_read_at) : null,
  };
}

function normalizeAdminMemberInquiryRow(raw: Record<string, unknown>): AdminMemberFileInquiryRow {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    email: String(raw.email ?? ""),
    phone: String(raw.phone ?? ""),
    body: String(raw.body ?? ""),
    status: String(raw.status ?? ""),
    created_at: String(raw.created_at ?? ""),
    resolved_at: raw.resolved_at ? String(raw.resolved_at) : null,
    admin_reply: raw.admin_reply != null ? String(raw.admin_reply) : null,
    reply_read_at: raw.reply_read_at != null ? String(raw.reply_read_at) : null,
  };
}

type SupabaseAdmin = ReturnType<typeof supabaseServer>;

type SupabaseMaybeSingleResult = {
  data: unknown;
  error: { message?: string } | null;
};

type SupabaseListResult = {
  data: unknown[] | null;
  error: { message?: string } | null;
};

async function selectUserInquiryRow(
  _sb: SupabaseAdmin,
  builder: (select: string) => { maybeSingle: () => Promise<SupabaseMaybeSingleResult> },
): Promise<UserInquiryRow | null> {
  let res: SupabaseMaybeSingleResult = await builder(INQUIRY_SELECT).maybeSingle();
  if (!res.error && res.data) return normalizeUserInquiryRow(res.data as Record<string, unknown>);
  if (res.error && isMissingInquiryReplyColumnError(res.error)) {
    res = await builder(INQUIRY_SELECT_LEGACY).maybeSingle();
    if (!res.error && res.data) return normalizeUserInquiryRow(res.data as Record<string, unknown>);
  }
  if (res.error) throw new Error(res.error.message);
  return null;
}

async function queryMyInquiryList(
  _sb: SupabaseAdmin,
  build: (select: string) => PromiseLike<SupabaseListResult>,
): Promise<MyInquiryListItem[]> {
  let res = await build(MY_INQUIRY_LIST_SELECT);
  if (res.error && isMissingInquiryReplyColumnError(res.error)) {
    res = await build(MY_INQUIRY_LIST_SELECT_LEGACY);
  }
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((row) => normalizeMyInquiryListItem(row as Record<string, unknown>));
}

export async function createUserInquiry(input: CreateUserInquiryInput): Promise<UserInquiryRow> {
  const err = validateInquiryInput(input);
  if (err) throw new Error(err);

  const payload = {
    user_id: input.userId?.trim() || null,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: normalizePhone(input.phone),
    body: input.body.trim(),
    status: "pending" as const,
  };

  const sb = supabaseServer();
  const { data: idRow, error: insertError } = await sb
    .from("user_inquiries")
    .insert(payload)
    .select("id")
    .single();

  if (insertError || !idRow?.id) {
    throw new Error(insertError?.message ?? "insert_failed");
  }

  let read = await sb.from("user_inquiries").select(INQUIRY_SELECT).eq("id", idRow.id).single();
  if (read.error && isMissingInquiryReplyColumnError(read.error)) {
    read = await sb.from("user_inquiries").select(INQUIRY_SELECT_LEGACY).eq("id", idRow.id).single();
  }
  if (read.error || !read.data) {
    throw new Error(read.error?.message ?? "insert_failed");
  }

  return normalizeUserInquiryRow(read.data as Record<string, unknown>);
}

export async function listPendingInquiries(limit = 50): Promise<UserInquiryRow[]> {
  const sb = supabaseServer();
  let res: SupabaseListResult = await sb
    .from("user_inquiries")
    .select(INQUIRY_SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (res.error && isMissingInquiryReplyColumnError(res.error)) {
    res = await sb
      .from("user_inquiries")
      .select(INQUIRY_SELECT_LEGACY)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(limit);
  }

  if (res.error) return [];
  return (res.data ?? []).map((row) => normalizeUserInquiryRow(row as Record<string, unknown>));
}

export async function listRecentResolvedInquiries(limit = 40): Promise<UserInquiryRow[]> {
  const sb = supabaseServer();
  let res: SupabaseListResult = await sb
    .from("user_inquiries")
    .select(INQUIRY_SELECT)
    .eq("status", "resolved")
    .order("resolved_at", { ascending: false })
    .limit(limit);

  if (res.error && isMissingInquiryReplyColumnError(res.error)) {
    res = await sb
      .from("user_inquiries")
      .select(INQUIRY_SELECT_LEGACY)
      .eq("status", "resolved")
      .order("resolved_at", { ascending: false })
      .limit(limit);
  }

  if (res.error) return [];
  return (res.data ?? []).map((row) => normalizeUserInquiryRow(row as Record<string, unknown>));
}

export async function resolveUserInquiry(
  id: string,
  adminReply: string,
  resolvedBy = "admin",
): Promise<UserInquiryRow> {
  const inquiryId = id.trim();
  if (!inquiryId) throw new Error("invalid_id");

  const replyErr = validateAdminInquiryReply(adminReply);
  if (replyErr) throw new Error(replyErr);

  const sb = supabaseServer();
  const now = new Date().toISOString();

  let res: SupabaseMaybeSingleResult = await sb
    .from("user_inquiries")
    .update({
      status: "resolved",
      resolved_at: now,
      resolved_by: resolvedBy,
      admin_reply: adminReply.trim(),
      reply_read_at: null,
    })
    .eq("id", inquiryId)
    .eq("status", "pending")
    .select(INQUIRY_SELECT)
    .maybeSingle();

  if (res.error && isMissingInquiryReplyColumnError(res.error)) {
    res = await sb
      .from("user_inquiries")
      .update({
        status: "resolved",
        resolved_at: now,
        resolved_by: resolvedBy,
      })
      .eq("id", inquiryId)
      .eq("status", "pending")
      .select(INQUIRY_SELECT_LEGACY)
      .maybeSingle();
  }

  if (res.error) throw new Error(res.error.message);
  if (res.data) return normalizeUserInquiryRow(res.data as Record<string, unknown>);

  let existingRes: SupabaseMaybeSingleResult = await sb
    .from("user_inquiries")
    .select(INQUIRY_SELECT)
    .eq("id", inquiryId)
    .maybeSingle();
  if (existingRes.error && isMissingInquiryReplyColumnError(existingRes.error)) {
    existingRes = await sb
      .from("user_inquiries")
      .select(INQUIRY_SELECT_LEGACY)
      .eq("id", inquiryId)
      .maybeSingle();
  }
  if (existingRes.error) throw new Error(existingRes.error.message);
  if (!existingRes.data) throw new Error("not_found");
  const existing = normalizeUserInquiryRow(existingRes.data as Record<string, unknown>);
  if (existing.status !== "resolved") throw new Error("resolve_failed");
  return existing;
}

async function inquiryIdsForMember(userId: string, memberEmail: string | null): Promise<string[]> {
  const rows = await listMyInquiriesForUser(userId, memberEmail);
  return rows.map((r) => r.id);
}

export async function listMyInquiriesForUser(
  userId: string,
  userEmail: string | null,
): Promise<MyInquiryListItem[]> {
  const sb = supabaseServer();
  const rows: MyInquiryListItem[] = [];
  const seen = new Set<string>();

  const byUser = await queryMyInquiryList(sb, (select) =>
    sb
      .from("user_inquiries")
      .select(select)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(80),
  );
  for (const r of byUser) {
    seen.add(r.id);
    rows.push(r);
  }

  const email = userEmail?.trim().toLowerCase();
  if (email) {
    const byEmail = await queryMyInquiryList(sb, (select) =>
      sb
        .from("user_inquiries")
        .select(select)
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(40),
    );
    for (const r of byEmail) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        rows.push(r);
      }
    }
  }

  return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function countUnreadInquiryRepliesForUser(userId: string, userEmail: string | null): Promise<number> {
  const rows = await listMyInquiriesForUser(userId, userEmail);
  return rows.filter(isInquiryReplyUnread).length;
}

export async function listGuestInquiriesByEmail(userEmail: string): Promise<MyInquiryListItem[]> {
  const email = userEmail?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return [];

  const sb = supabaseServer();
  return queryMyInquiryList(sb, (select) =>
    sb
      .from("user_inquiries")
      .select(select)
      .ilike("email", email)
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(80),
  );
}

export async function countUnreadGuestInquiryRepliesByEmail(userEmail: string): Promise<number> {
  const rows = await listGuestInquiriesByEmail(userEmail);
  return rows.filter(isInquiryReplyUnread).length;
}

async function guestInquiryIdsForEmail(userEmail: string): Promise<string[]> {
  const rows = await listGuestInquiriesByEmail(userEmail);
  return rows.map((r) => r.id);
}

export async function markGuestInquiryReplyReadByEmail(
  inquiryId: string,
  userEmail: string,
): Promise<MyInquiryListItem | null> {
  const id = inquiryId.trim();
  if (!id) throw new Error("invalid_id");

  const email = userEmail?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) throw new Error("invalid_email");

  const allowedIds = await guestInquiryIdsForEmail(email);
  if (!allowedIds.includes(id)) throw new Error("forbidden");

  const sb = supabaseServer();
  const now = new Date().toISOString();

  let res = await sb
    .from("user_inquiries")
    .update({ reply_read_at: now })
    .eq("id", id)
    .eq("status", "resolved")
    .not("admin_reply", "is", null)
    .is("reply_read_at", null)
    .select(MY_INQUIRY_LIST_SELECT)
    .maybeSingle();

  if (res.error && isMissingInquiryReplyColumnError(res.error)) {
    return null;
  }
  if (res.error) throw new Error(res.error.message);
  if (res.data) return normalizeMyInquiryListItem(res.data as Record<string, unknown>);

  const existing = await queryMyInquiryList(sb, (select) =>
    sb.from("user_inquiries").select(select).eq("id", id).limit(1),
  );
  if (existing.length === 0) throw new Error("not_found");
  return existing[0] ?? null;
}

export async function markInquiryReplyReadForUser(
  inquiryId: string,
  userId: string,
  userEmail: string | null,
): Promise<MyInquiryListItem | null> {
  const id = inquiryId.trim();
  if (!id) throw new Error("invalid_id");

  const allowedIds = await inquiryIdsForMember(userId, userEmail);
  if (!allowedIds.includes(id)) throw new Error("forbidden");

  const sb = supabaseServer();
  const now = new Date().toISOString();

  let res = await sb
    .from("user_inquiries")
    .update({ reply_read_at: now })
    .eq("id", id)
    .eq("status", "resolved")
    .not("admin_reply", "is", null)
    .is("reply_read_at", null)
    .select(MY_INQUIRY_LIST_SELECT)
    .maybeSingle();

  if (res.error && isMissingInquiryReplyColumnError(res.error)) {
    return null;
  }
  if (res.error) throw new Error(res.error.message);
  if (res.data) return normalizeMyInquiryListItem(res.data as Record<string, unknown>);

  const existing = await queryMyInquiryList(sb, (select) =>
    sb.from("user_inquiries").select(select).eq("id", id).limit(1),
  );
  if (existing.length === 0) throw new Error("not_found");
  return existing[0] ?? null;
}

export async function listInquiriesForMember(userId: string, memberEmail: string | null): Promise<AdminMemberFileInquiryRow[]> {
  const sb = supabaseServer();
  const inquirySelect =
    "id,name,email,phone,body,status,created_at,resolved_at,admin_reply,reply_read_at";
  const inquirySelectLegacy = "id,name,email,phone,body,status,created_at,resolved_at";

  async function queryMemberList(select: string) {
    const byUser = await sb
      .from("user_inquiries")
      .select(select)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(80);

    if (byUser.error) return { error: byUser.error, rows: [] as AdminMemberFileInquiryRow[] };

    const rows = (byUser.data ?? []).map((row) =>
      normalizeAdminMemberInquiryRow(row as unknown as Record<string, unknown>),
    );
    const seen = new Set(rows.map((r) => r.id));

    const email = memberEmail?.trim().toLowerCase();
    if (email) {
      const byEmail = await sb
        .from("user_inquiries")
        .select(select)
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(40);

      if (!byEmail.error) {
        for (const row of byEmail.data ?? []) {
          const r = normalizeAdminMemberInquiryRow(row as unknown as Record<string, unknown>);
          if (!seen.has(r.id)) {
            seen.add(r.id);
            rows.push(r);
          }
        }
      }
    }

    return { error: null, rows };
  }

  let result = await queryMemberList(inquirySelect);
  if (result.error && isMissingInquiryReplyColumnError(result.error)) {
    result = await queryMemberList(inquirySelectLegacy);
  }
  if (result.error) return [];

  return result.rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
