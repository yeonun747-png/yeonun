import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "yeonun_admin";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "Missing env: ADMIN_PASSWORD" },
      { status: 500 },
    );
  }

  if (password !== expected) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const jar = await cookies();
  jar.set(COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.redirect(new URL("/admin", request.url));
}

