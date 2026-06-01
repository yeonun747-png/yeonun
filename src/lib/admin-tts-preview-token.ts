import { createHmac, timingSafeEqual } from "node:crypto";

import { ADMIN_TTS_PREVIEW_HEADER } from "@/lib/admin-tts-preview-constants";
import { ADMIN_COOKIE_NAME, verifyAdminSessionCookieValue } from "@/lib/admin-cookie";
import { cookies } from "next/headers";

const ADMIN_COOKIE = ADMIN_COOKIE_NAME;

function adminPasswordConfigured(): boolean {
  return Boolean(String(process.env.ADMIN_PASSWORD ?? "").trim());
}

function signingSecret(): string | null {
  const s =
    String(process.env.ADMIN_TTS_PREVIEW_HMAC_SECRET ?? "").trim() ||
    String(process.env.ADMIN_PASSWORD ?? "").trim();
  return s || null;
}

function verifyAdminTtsPreviewToken(token: string): boolean {
  const secret = signingSecret();
  if (!secret || !adminPasswordConfigured()) return false;

  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payloadB64 || !sig) return false;

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const expectedSig = createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    if (expectedSig.length !== sig.length) return false;
    if (!timingSafeEqual(Buffer.from(expectedSig, "utf8"), Buffer.from(sig, "utf8"))) return false;
  } catch {
    return false;
  }

  try {
    const obj = JSON.parse(payload) as { exp?: number };
    const exp = Number(obj.exp);
    if (!Number.isFinite(exp)) return false;
    if (exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * 어드민 TTS 미리듣기 API 허용 여부.
 * - ADMIN_PASSWORD 미설정(로컬 등): 항상 허용
 * - yeonun_admin 쿠키 또는 유효한 단기 HMAC 토큰 헤더
 */
export async function isAdminTtsPreviewAuthorized(request: Request): Promise<boolean> {
  if (!adminPasswordConfigured()) return process.env.NODE_ENV !== "production";

  const jar = await cookies();
  if (verifyAdminSessionCookieValue(jar.get(ADMIN_COOKIE)?.value)) return true;

  const tok = request.headers.get(ADMIN_TTS_PREVIEW_HEADER)?.trim();
  if (tok && verifyAdminTtsPreviewToken(tok)) return true;

  return false;
}

/**
 * SSR에서만 호출: 어드민 쿠키가 있을 때 미리듣기용 단기 토큰 발급.
 * 모바일 등에서 쿠키가 fetch에 실리지 않는 경우에도, 페이지 로드 시점의 쿠키로 발급된 토큰이면 통과합니다.
 */
export async function createAdminTtsPreviewToken(): Promise<string | null> {
  if (!adminPasswordConfigured()) return null;

  const jar = await cookies();
  if (!verifyAdminSessionCookieValue(jar.get(ADMIN_COOKIE)?.value)) return null;

  const secret = signingSecret();
  if (!secret) return null;

  const exp = Math.floor(Date.now() / 1000) + 20 * 60;
  const payload = JSON.stringify({ exp });
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}
