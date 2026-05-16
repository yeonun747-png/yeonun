import { NextResponse } from "next/server";

import { buildCatalogSnapshot } from "@/lib/content-catalog";
import { getContentCatalogBundleCached } from "@/lib/data/content";

export const runtime = "nodejs";
export const revalidate = 120;

export async function GET() {
  try {
    const { categories, products, thumbFallback } = await getContentCatalogBundleCached();
    const body = buildCatalogSnapshot({ categories, products, thumbFallback });
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "catalog_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
