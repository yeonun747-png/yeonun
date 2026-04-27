import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "yeonun_admin";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === "/admin/login") return NextResponse.next();

  const isAuthed = request.cookies.get(COOKIE_NAME)?.value === "1";
  if (isAuthed) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};

