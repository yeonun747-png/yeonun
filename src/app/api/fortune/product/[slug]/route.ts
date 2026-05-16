import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

import { getCharacters } from "@/lib/data/characters";
import { getProductBySlug } from "@/lib/data/content";

export const runtime = "nodejs";
export const revalidate = 120;

const getFortuneProductBundle = unstable_cache(
  async (slug: string) => {
    const product = await getProductBySlug(slug);
    if (!product) return null;
    const characters = await getCharacters();
    const character = characters.find((c) => c.key === product.character_key) ?? null;
    return { product, character };
  },
  ["fortune-product-bundle"],
  { revalidate: 120 },
);

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const key = slug.trim();
    if (!key) return NextResponse.json({ error: "missing_slug" }, { status: 400 });

    const bundle = await getFortuneProductBundle(key);
    if (!bundle) return NextResponse.json({ error: "not_found" }, { status: 404 });

    return NextResponse.json(
      {
        v: 1 as const,
        slug: key,
        product: bundle.product,
        character: bundle.character,
        fetchedAt: Date.now(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "fortune_product_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
