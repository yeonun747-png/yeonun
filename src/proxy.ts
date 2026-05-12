import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "yeonun_admin";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const adminPw = String(process.env.ADMIN_PASSWORD ?? "").trim();
  if (!adminPw) return NextResponse.next();

  if (
    pathname === "/admin/login" ||
    pathname === "/admin/login/action" ||
    pathname === "/admin/logout"
  ) {
    return NextResponse.next();
  }

  const isAuthed = request.cookies.get(COOKIE_NAME)?.value === "1";
  if (isAuthed) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
