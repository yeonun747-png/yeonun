import type { MetadataRoute } from "next";

import { buildRobotsConfig } from "@/lib/seo-sitemap";

export default function robots(): MetadataRoute.Robots {
  return buildRobotsConfig();
}
