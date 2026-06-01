import { formatPhoneKrInput, phoneKrDigitCount } from "@/lib/format-phone-kr";
import { supabaseServer } from "@/lib/supabase/server";

export type UserInquiryRow = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string;
  body: string;
  status: "pending" | "resolved";
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type CreateUserInquiryInput = {
  userId?: string | null;
  name: string;
  email: string;
  phone: string;
  body: string;
};

export type AdminMemberFileInquiryRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  body: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
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

export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return formatPhoneKrInput(trimmed);
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

  const { data, error } = await supabaseServer()
    .from("user_inquiries")
    .insert(payload)
    .select("id,user_id,name,email,phone,body,status,created_at,resolved_at,resolved_by")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "insert_failed");
  }

  return data as UserInquiryRow;
}

export async function listPendingInquiries(limit = 50): Promise<UserInquiryRow[]> {
  const { data, error } = await supabaseServer()
    .from("user_inquiries")
    .select("id,user_id,name,email,phone,body,status,created_at,resolved_at,resolved_by")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as UserInquiryRow[];
}

export async function listRecentResolvedInquiries(limit = 40): Promise<UserInquiryRow[]> {
  const { data, error } = await supabaseServer()
    .from("user_inquiries")
    .select("id,user_id,name,email,phone,body,status,created_at,resolved_at,resolved_by")
    .eq("status", "resolved")
    .order("resolved_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as UserInquiryRow[];
}

export async function resolveUserInquiry(id: string, resolvedBy = "admin"): Promise<UserInquiryRow> {
  const inquiryId = id.trim();
  if (!inquiryId) throw new Error("invalid_id");

  const sb = supabaseServer();
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from("user_inquiries")
    .update({
      status: "resolved",
      resolved_at: now,
      resolved_by: resolvedBy,
    })
    .eq("id", inquiryId)
    .eq("status", "pending")
    .select("id,user_id,name,email,phone,body,status,created_at,resolved_at,resolved_by")
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (data) return data as UserInquiryRow;

  const { data: existing, error: readErr } = await sb
    .from("user_inquiries")
    .select("id,user_id,name,email,phone,body,status,created_at,resolved_at,resolved_by")
    .eq("id", inquiryId)
    .maybeSingle();

  if (readErr || !existing) throw new Error("not_found");
  if (existing.status !== "resolved") throw new Error("resolve_failed");

  return existing as UserInquiryRow;
}

export async function listInquiriesForMember(userId: string, memberEmail: string | null): Promise<AdminMemberFileInquiryRow[]> {
  const sb = supabaseServer();
  const inquirySelect = "id,name,email,phone,body,status,created_at,resolved_at";
  const byUser = await sb
    .from("user_inquiries")
    .select(inquirySelect)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(80);

  if (byUser.error) return [];

  const rows = (byUser.data ?? []) as AdminMemberFileInquiryRow[];
  const seen = new Set(rows.map((r) => r.id));

  const email = memberEmail?.trim().toLowerCase();
  if (email) {
    const byEmail = await sb
      .from("user_inquiries")
      .select(inquirySelect)
      .is("user_id", null)
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(40);

    if (!byEmail.error) {
      for (const r of (byEmail.data ?? []) as AdminMemberFileInquiryRow[]) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          rows.push(r);
        }
      }
    }
  }

  return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
