import "server-only";

import type { CreditLedgerRow } from "@/lib/credit-server";
import { supabaseServer } from "@/lib/supabase/server";
import type { CreditUsageContext } from "@/lib/my-credit-usage";
import { titleFromProductSlugForUsage } from "@/lib/my-credit-usage";

export async function resolveCreditUsageContext(rows: CreditLedgerRow[]): Promise<CreditUsageContext> {
  const supabase = supabaseServer();
  const slugs = new Set<string>();
  const orderIds = new Set<string>();

  for (const row of rows) {
    if (row.ref_type === "product" && row.ref_id) slugs.add(row.ref_id);
    if (row.kind === "purchase" && row.ref_type === "order" && row.ref_id) orderIds.add(row.ref_id);
  }

  const productNames = new Map<string, string>();
  const orderPurchaseTitles = new Map<string, string>();

  if (slugs.size > 0) {
    const { data } = await supabase.from("products").select("slug,title").in("slug", [...slugs]);
    for (const p of data ?? []) {
      const row = p as { slug?: string; title?: string };
      productNames.set(String(row.slug), String(row.title ?? row.slug));
    }
  }

  if (orderIds.size > 0) {
    const { data } = await supabase.from("orders").select("id,product_slug").in("id", [...orderIds]);
    for (const o of data ?? []) {
      const row = o as { id?: string; product_slug?: string | null };
      const slug = String(row.product_slug ?? "").trim();
      const id = String(row.id ?? "");
      if (!id) continue;
      orderPurchaseTitles.set(id, slug ? titleFromProductSlugForUsage(slug) : "크레딧 충전");
    }
  }

  return { productNames, orderPurchaseTitles };
}
