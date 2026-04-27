"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useModalControls() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const close = () => {
    const next = new URLSearchParams(sp.toString());
    next.delete("modal");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return { close };
}

