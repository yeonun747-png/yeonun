import { ContentPageClient } from "@/components/content/ContentPageClient";
import { buildCatalogSnapshot, parseContentSort } from "@/lib/content-catalog";
import { getContentCatalogBundleCached } from "@/lib/data/content";

export const revalidate = 120;

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const category = sp.category ?? "all";
  const sort = parseContentSort(sp.sort);

  const { categories, products, thumbFallback } = await getContentCatalogBundleCached();
  const serverCatalog = buildCatalogSnapshot({ categories, products, thumbFallback });

  return <ContentPageClient category={category} sort={sort} serverCatalog={serverCatalog} />;
}
