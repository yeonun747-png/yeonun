import { NextResponse } from "next/server";

import { getProductsBySlugsCached } from "@/lib/data/content";
import { buildLibraryListItemVm } from "@/lib/library-list-vm";
import { listFortuneLibraryItems, type FortuneLibraryListRow } from "@/lib/library-fortune";

export const dynamic = "force-dynamic";

function rowSortTime(row: FortuneLibraryListRow): number {
  const iso = row.completed_at || row.created_at;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export async function GET() {
  try {
    const rows = await listFortuneLibraryItems();
    const slugs = [...new Set(rows.map((r) => r.product_slug).filter(Boolean))] as string[];
    const products = slugs.length ? await getProductsBySlugsCached(slugs) : [];
    const productTitleBySlug = Object.fromEntries(products.map((p) => [p.slug, p.title]));
    const sorted = [...rows].sort((a, b) => rowSortTime(b) - rowSortTime(a));
    const items = sorted.map((r) => buildLibraryListItemVm(r, productTitleBySlug));
    return NextResponse.json({ ok: true as const, items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "목록을 불러오지 못했습니다.";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
