import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "yeonun_admin";

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
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const jar = await cookies();
  const secure = requestIsHttps(request);
  jar.set(COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.redirect(new URL("/admin", request.url), 303);
}

