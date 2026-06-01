import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "yeonun_admin";

const MAX_AGE_SEC = 60 * 60 * 24 * 30;

function adminSigningSecret(): string {
  return String(process.env.ADMIN_PASSWORD ?? "").trim();
}

type AdminCookiePayload = { exp: number; v: 1 };

export function mintAdminSessionCookieValue(): string | null {
  const secret = adminSigningSecret();
  if (!secret) return null;
  const payload: AdminCookiePayload = {
    v: 1,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** 레거시 `yeonun_admin=1` — 서명 쿠키 전환 전 호환 */
export function verifyAdminSessionCookieValue(raw: string | undefined | null): boolean {
  const value = String(raw ?? "").trim();
  if (!value) return false;
  if (value === "1") return Boolean(adminSigningSecret());

  const secret = adminSigningSecret();
  if (!secret) return process.env.NODE_ENV !== "production";

  const dot = value.lastIndexOf(".");
  if (dot < 1) return false;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AdminCookiePayload;
    if (payload?.v !== 1 || !Number.isFinite(payload.exp)) return false;
    return payload.exp >= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export const ADMIN_COOKIE_MAX_AGE_SEC = MAX_AGE_SEC;
