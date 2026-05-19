"use client";

import { useEffect } from "react";

import { onMissionDreamLibraryViewed } from "@/lib/mission-complete";

export function LibraryDreamMissionHook({ productSlug }: { productSlug: string }) {
  useEffect(() => {
    if (productSlug === "dream-lastnight") {
      void onMissionDreamLibraryViewed();
    }
  }, [productSlug]);
  return null;
}
