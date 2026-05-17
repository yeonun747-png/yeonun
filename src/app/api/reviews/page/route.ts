import { NextResponse } from "next/server";

import {
  getReviewsPageDataCached,
  getReviewsPageDataForCharacterCached,
} from "@/lib/reviews";
import { parseCharacterReviewKey } from "@/lib/reviews-types";

export const revalidate = 60;

export async function GET(req: Request) {
  try {
    const characterKey = parseCharacterReviewKey(new URL(req.url).searchParams.get("character"));
    const data = characterKey
      ? await getReviewsPageDataForCharacterCached(characterKey)
      : await getReviewsPageDataCached();

    return NextResponse.json(
      {
        v: 1,
        fetchedAt: Date.now(),
        ...data,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
