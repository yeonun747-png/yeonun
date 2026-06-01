import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  ADMIN_COOKIE_MAX_AGE_SEC,
  ADMIN_COOKIE_NAME,
  mintAdminSessionCookieValue,
} from "@/lib/admin-cookie";

function requestIsHttps(request: Request): boolean {
  const u = new URL(request.url);
  if (u.protocol === "https:") return true;
  const xf = request.headers.get("x-forwarded-proto");
  return xf?.split(",")[0]?.trim() === "https";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.redirect(new URL("/admin", request.url), 303);
  }

  if (password !== expected) {
    const u = new URL("/admin/login", request.url);
    u.searchParams.set("e", "1");
    return NextResponse.redirect(u, 303);
  }

  const jar = await cookies();
  const secure = requestIsHttps(request);
  const domain = String(process.env.ADMIN_COOKIE_DOMAIN ?? "").trim() || undefined;
  const signed = mintAdminSessionCookieValue();
  if (!signed) {
    return NextResponse.redirect(new URL("/admin", request.url), 303);
  }
  jar.set(ADMIN_COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: ADMIN_COOKIE_MAX_AGE_SEC,
    ...(domain ? { domain } : {}),
  });

  return NextResponse.redirect(new URL("/admin", request.url), 303);
}

