import { LibraryListScreenClient } from "@/components/library/LibraryListScreenClient";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";
import { getProductsBySlugsCached } from "@/lib/data/content";
import { buildLibraryListItemVm } from "@/lib/library-list-vm";
import { listFortuneLibraryItems, type FortuneLibraryListRow } from "@/lib/library-fortune";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "점사 보관함 | 연운 緣運",
  description: "저장한 점사 풀이를 다시 열람합니다.",
  robots: { index: false, follow: true },
};

function rowSortTime(row: FortuneLibraryListRow): number {
  const iso = row.completed_at || row.created_at;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function resolveBackHref(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v === "string" && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/my";
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ back?: string | string[] }>;
}) {
  const sp = await searchParams;
  const backHref = resolveBackHref(sp.back);

  let rows: FortuneLibraryListRow[] = [];
  let loadError: string | null = null;
  try {
    rows = await listFortuneLibraryItems();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "목록을 불러오지 못했습니다.";
  }

  const slugs = [...new Set(rows.map((r) => r.product_slug).filter(Boolean))] as string[];
  const products = slugs.length ? await getProductsBySlugsCached(slugs) : [];
  const productTitleBySlug = Object.fromEntries(products.map((p) => [p.slug, p.title]));

  const sorted = [...rows].sort((a, b) => rowSortTime(b) - rowSortTime(a));
  const items = sorted.map((r) => buildLibraryListItemVm(r, productTitleBySlug));

  return (
    <>
      <MyTabBackdrop />
      <LibraryListScreenClient items={items} loadError={loadError} backHref={backHref} />
    </>
  );
}
