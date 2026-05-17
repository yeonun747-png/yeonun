import { cookies } from "next/headers";

const COOKIE_NAME = "yeonun_admin";

/** 어드민 API — ADMIN_PASSWORD 미설정 시 통과 */
export async function isAdminRequest(): Promise<boolean> {
  const expected = String(process.env.ADMIN_PASSWORD ?? "").trim();
  if (!expected) return true;
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value === "1";
}
