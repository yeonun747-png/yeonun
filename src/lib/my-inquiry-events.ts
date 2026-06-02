export const YEONUN_MY_INQUIRIES_CHANGED = "yeonun:my-inquiries-changed";

export function notifyMyInquiriesChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(YEONUN_MY_INQUIRIES_CHANGED));
}
