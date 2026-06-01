import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ADMIN_COOKIE_NAME } from "@/lib/admin-cookie";

export async function POST(request: Request) {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return NextResponse.redirect(new URL("/admin/login", request.url), 303);
}
