import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

const thumbDir = () => path.join(process.cwd(), "public", "product-thumbnails");

export const readProductThumbnailSvg = cache(async (slug: string): Promise<string | null> => {
  try {
    return await readFile(path.join(thumbDir(), `${slug}.svg`), "utf8");
  } catch {
    return null;
  }
});

/** 여러 slug에 대해 `public/product-thumbnails/{slug}.svg` 내용을 한 번에 로드 (DB 미등록 시 카드 폴백용) */
export async function readProductThumbnailsForSlugs(slugs: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(slugs.filter(Boolean))];
  const pairs = await Promise.all(
    unique.map(async (slug) => [slug, await readProductThumbnailSvg(slug)] as const),
  );
  const out: Record<string, string> = {};
  for (const [slug, content] of pairs) {
    if (content) out[slug] = content;
  }
  return out;
}
