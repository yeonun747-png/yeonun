/** 클라이언트·서버 공용 — Supabase 서버 import 없음 */

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
  admin_reply: string | null;
  reply_read_at: string | null;
};

export type MyInquiryListItem = Pick<
  UserInquiryRow,
  "id" | "body" | "status" | "created_at" | "resolved_at" | "admin_reply" | "reply_read_at"
>;

export type AdminMemberFileInquiryRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  body: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  admin_reply: string | null;
  reply_read_at: string | null;
};

export function isInquiryReplyUnread(row: Pick<UserInquiryRow, "status" | "admin_reply" | "reply_read_at">): boolean {
  return row.status === "resolved" && !!String(row.admin_reply ?? "").trim() && !row.reply_read_at;
}
