"use client";

import { useEffect } from "react";

import { captureReferralFromUrl } from "@/lib/referral-pending";

export function ReferralCaptureClient() {
  useEffect(() => {
    captureReferralFromUrl();
  }, []);
  return null;
}
