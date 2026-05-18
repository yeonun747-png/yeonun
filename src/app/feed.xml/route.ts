import { getProducts } from "@/lib/data/content";
import { listPublishedNotices } from "@/lib/notices";
import { buildSiteRssFeed } from "@/lib/seo-feed";

export const revalidate = 3600;

export async function GET() {
  const [products, notices] = await Promise.all([getProducts(), listPublishedNotices()]);
  const xml = buildSiteRssFeed({ products, notices });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
