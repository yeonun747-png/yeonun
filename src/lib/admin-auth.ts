import { cookies } from "next/headers";

import { ADMIN_COOKIE_NAME, verifyAdminSessionCookieValue } from "@/lib/admin-cookie";

/** 어드민 API — 프로덕션에서 ADMIN_PASSWORD 미설정 시 거부 */
export async function isAdminRequest(): Promise<boolean> {
  const expected = String(process.env.ADMIN_PASSWORD ?? "").trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  const jar = await cookies();
  return verifyAdminSessionCookieValue(jar.get(ADMIN_COOKIE_NAME)?.value);
}

export { ADMIN_COOKIE_NAME };
