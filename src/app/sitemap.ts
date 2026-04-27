import type { MetadataRoute } from "next";

import { getProducts } from "@/lib/data/content";
import { getCharacters } from "@/lib/data/characters";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const [products, characters] = await Promise.all([getProducts(), getCharacters()]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/meet`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/today`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/content`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/my`, changeFrequency: "weekly", priority: 0.3 },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/content/${p.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const characterRoutes: MetadataRoute.Sitemap = characters.map((c) => ({
    url: `${base}/characters/${c.key}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...productRoutes, ...characterRoutes];
}

