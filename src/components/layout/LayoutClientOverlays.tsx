"use client";

import { useEffect, useState, type ReactNode } from "react";

import { ModalLayer } from "@/components/ModalLayer";
import { StorageNoticeBanner } from "@/components/legal/StorageNoticeBanner";
import { SignupCreditPromoSheet } from "@/components/promo/SignupCreditPromoSheet";

/** SSR·첫 하이드레이션은 null — 이후에만 마운트(useSearchParams 등 클라이언트 전용 트리) */
function ClientOnlyMount({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return children;
}

export function ModalLayerClient() {
  return (
    <ClientOnlyMount>
      <ModalLayer />
    </ClientOnlyMount>
  );
}

export function StorageNoticeBannerClient() {
  return (
    <ClientOnlyMount>
      <StorageNoticeBanner />
    </ClientOnlyMount>
  );
}

export function SignupCreditPromoSheetClient() {
  return (
    <ClientOnlyMount>
      <SignupCreditPromoSheet />
    </ClientOnlyMount>
  );
}
