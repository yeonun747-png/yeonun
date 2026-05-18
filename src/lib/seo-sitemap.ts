import type { MetadataRoute } from "next";

import type { Product } from "@/lib/data/content";
import type { Character } from "@/lib/data/characters";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";
import { toSitemapLastMod } from "@/lib/seo-xml";

function staticEntry(
  path: string,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"] = "weekly",
  lastModified?: string | Date,
): MetadataRoute.Sitemap[0] {
  return {
    url: absoluteUrl(path),
    changeFrequency,
    priority,
    ...(toSitemapLastMod(lastModified) ? { lastModified: new Date(toSitemapLastMod(lastModified)!) } : {}),
  };
}

/** 검색엔진에 노출할 공개 URL 목록 */
export function buildPublicSitemapEntries(input: {
  products: Product[];
  characters: Character[];
}): MetadataRoute.Sitemap {
  const now = new Date();
  const { products, characters } = input;

  const staticRoutes: MetadataRoute.Sitemap = [
    staticEntry("/", 1, "daily", now),
    staticEntry("/content", 0.95, "daily", now),
    staticEntry("/meet", 0.85, "weekly", now),
    staticEntry("/today", 0.8, "daily", now),
    staticEntry("/reviews", 0.75, "weekly", now),
    staticEntry("/search", 0.6, "weekly", now),
    staticEntry("/company/about", 0.7, "monthly", now),
    staticEntry("/support", 0.65, "monthly", now),
    staticEntry("/notices", 0.55, "weekly", now),
    staticEntry("/legal/terms", 0.4, "yearly", now),
    staticEntry("/legal/privacy", 0.4, "yearly", now),
  ];

  const productRoutes: MetadataRoute.Sitemap = products.flatMap((p) => {
    const lastModified = p.created_at ? new Date(p.created_at) : now;
    return [
      {
        url: absoluteUrl(`/content/${p.slug}`),
        changeFrequency: "weekly" as const,
        priority: 0.85,
        lastModified,
      },
      {
        url: absoluteUrl(`/fortune/${p.slug}`),
        changeFrequency: "weekly" as const,
        priority: 0.9,
        lastModified,
      },
    ];
  });

  const characterRoutes: MetadataRoute.Sitemap = characters.map((c) =>
    staticEntry(`/characters/${c.key}`, 0.7, "monthly", now),
  );

  return [...staticRoutes, ...productRoutes, ...characterRoutes];
}

export function buildRobotsConfig(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/auth",
          "/checkout/",
          "/payment/",
          "/library",
          "/history/",
          "/my",
          "/settings/",
          "/call-dcc",
          "/call-live",
          "/call",
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site.replace(/^https?:\/\//, ""),
  };
}
