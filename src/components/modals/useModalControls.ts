"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const MODAL_QUERY_KEYS = [
  "modal",
  "auth_error",
  "auth_error_provider",
  "auth_error_hint",
  "onboard",
  "after_auth",
  "product",
  "title",
  "price",
  "grant_base",
  "credits",
  "character_key",
  "profile",
  "first_voice_credit_bonus",
  "minutes",
] as const;

export function useModalControls() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const search = sp.toString();

  const close = useCallback(() => {
    const next = new URLSearchParams(search);
    for (const key of MODAL_QUERY_KEYS) {
      next.delete(key);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, search]);

  return { close };
}
