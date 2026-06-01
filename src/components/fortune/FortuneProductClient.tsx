"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";

import { FortunePage } from "@/components/fortune/FortunePage";
import { FortuneProductLoadingShell } from "@/components/fortune/FortuneProductLoadingShell";
import {
  preloadFortuneProduct,
  resolveInitialFortuneProduct,
  type FortuneProductBundle,
} from "@/lib/fortune-product-cache";

export function FortuneProductClient({
  slug,
  themeKey,
  backRaw,
  menuCardEntry,
  initialBundle,
}: {
  slug: string;
  themeKey: string;
  backRaw?: string;
  menuCardEntry: boolean;
  initialBundle: FortuneProductBundle;
}) {
  const [bundle, setBundle] = useState<FortuneProductBundle | null>(initialBundle);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setBundle(resolveInitialFortuneProduct(slug, initialBundle));
    setMissing(false);
    let cancelled = false;
    void preloadFortuneProduct(slug, { force: true }).then((next) => {
      if (cancelled) return;
      if (!next) {
        setMissing(true);
        return;
      }
      setBundle((prev) => (!prev || next.fetchedAt >= prev.fetchedAt ? next : prev));
    });
    return () => {
      cancelled = true;
    };
  }, [slug, initialBundle]);

  if (missing) notFound();

  if (!bundle) {
    const backHref = backRaw?.trim() || "/content";
    return <FortuneProductLoadingShell backHref={backHref} />;
  }

  return (
    <FortunePage
      product={bundle.product}
      character={bundle.character}
      themeKey={themeKey}
      backRaw={backRaw}
      menuCardEntry={menuCardEntry}
    />
  );
}
