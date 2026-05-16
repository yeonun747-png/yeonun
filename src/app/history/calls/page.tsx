"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CallHistoryIndexRedirectInner() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const back = sp.get("back");
    const qs = new URLSearchParams();
    qs.set("shelf", "voice");
    if (typeof back === "string" && back.startsWith("/") && !back.startsWith("//")) {
      qs.set("back", back);
    }
    router.replace(`/my?${qs.toString()}`, { scroll: false });
  }, [router, sp]);

  return null;
}

export default function CallHistoryIndexRedirect() {
  return (
    <Suspense fallback={null}>
      <CallHistoryIndexRedirectInner />
    </Suspense>
  );
}
