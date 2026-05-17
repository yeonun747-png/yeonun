import { NextResponse } from "next/server";

import { getHomeReviewsBlockDataCached } from "@/lib/reviews";

export const revalidate = 60;

export async function GET() {
  try {
    const payload = await getHomeReviewsBlockDataCached();
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
