const GUEST_INQUIRY_EMAIL_KEY = "yeonun:guest-inquiry-email";

export function getStoredGuestInquiryEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(GUEST_INQUIRY_EMAIL_KEY)?.trim().toLowerCase() ?? "";
  } catch {
    return "";
  }
}

export function setStoredGuestInquiryEmail(email: string): void {
  if (typeof window === "undefined") return;
  const normalized = email.trim().toLowerCase();
  try {
    if (normalized) sessionStorage.setItem(GUEST_INQUIRY_EMAIL_KEY, normalized);
    else sessionStorage.removeItem(GUEST_INQUIRY_EMAIL_KEY);
  } catch {
    /* ignore */
  }
}
