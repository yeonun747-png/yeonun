export const YEONUN_ADMIN_INQUIRIES_CHANGED = "yeonun:admin-inquiries-changed";

export function notifyAdminInquiriesChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(YEONUN_ADMIN_INQUIRIES_CHANGED));
}
