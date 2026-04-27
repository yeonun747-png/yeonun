"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

const AuthModal = dynamic(() => import("@/components/modals/AuthModal").then((m) => m.AuthModal), { ssr: false });
const SajuModal = dynamic(() => import("@/components/modals/SajuModal").then((m) => m.SajuModal), { ssr: false });
const PaymentModal = dynamic(() => import("@/components/modals/PaymentModal").then((m) => m.PaymentModal), { ssr: false });

export function ModalLayer() {
  const sp = useSearchParams();
  const modal = sp.get("modal");
  if (modal === "auth") return <AuthModal />;
  if (modal === "saju") return <SajuModal />;
  if (modal === "payment") return <PaymentModal />;
  return null;
}

