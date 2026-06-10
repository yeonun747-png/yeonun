import { getProductBySlugCached } from "@/lib/data/content";
import { listFortuneLibraryItems, type FortuneLibraryListRow } from "@/lib/library-fortune";
import { isLibraryRetentionValid, parseLibraryRetentionFromProduct } from "@/lib/library-retention";

function rowSortTime(row: FortuneLibraryListRow): number {
  const iso = row.completed_at || row.created_at;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export type FortuneLibraryDuplicateHit = {
  request_id: string;
  viewed_at: string;
};

export async function findFortuneLibraryDuplicate(
  userRef: string,
  productSlug: string,
  sajuFingerprint: string,
): Promise<FortuneLibraryDuplicateHit | null> {
  const slug = productSlug.trim();
  const fp = sajuFingerprint.trim();
  if (!slug || !fp) return null;

  const product = await getProductBySlugCached(slug);
  const policy = parseLibraryRetentionFromProduct(product);

  const rows = await listFortuneLibraryItems(userRef);
  let best: FortuneLibraryListRow | null = null;
  let bestTime = 0;

  for (const row of rows) {
    if (row.product_slug !== slug) continue;
    const rowFp = row.payload.saju_fingerprint?.trim();
    if (!rowFp || rowFp !== fp) continue;
    const when = row.completed_at || row.created_at;
    if (!isLibraryRetentionValid(when, policy)) continue;
    const t = rowSortTime(row);
    if (t > bestTime) {
      bestTime = t;
      best = row;
    }
  }

  if (!best) return null;
  return {
    request_id: best.request_id,
    viewed_at: best.completed_at || best.created_at,
  };
}
