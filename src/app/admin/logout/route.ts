import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "yeonun_admin";

export async function POST(request: Request) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return NextResponse.redirect(new URL("/admin/login", request.url), 303);
}
