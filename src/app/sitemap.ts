import type { MetadataRoute } from "next";

import { getProducts } from "@/lib/data/content";
import { getCharacters } from "@/lib/data/characters";
import { buildPublicSitemapEntries } from "@/lib/seo-sitemap";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, characters] = await Promise.all([getProducts(), getCharacters()]);

  return buildPublicSitemapEntries({ products, characters });
}
