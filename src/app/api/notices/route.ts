import { NextResponse } from "next/server";

import { listPublishedNotices } from "@/lib/notices";

export const revalidate = 60;

export async function GET() {
  const notices = await listPublishedNotices();
  return NextResponse.json({ notices });
}
