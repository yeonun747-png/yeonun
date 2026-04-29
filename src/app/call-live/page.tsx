import { Suspense } from "react";
import type { Metadata } from "next";

import CallLivePageClient from "./CallLivePageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "VOICE LIVE | 연운",
  description: "실시간 음성 대화(라이브).",
  alternates: { canonical: "/call-live" },
  robots: { index: false, follow: false },
};

export default function CallLivePage() {
  return (
    <Suspense fallback={<div className="yeonunPage" style={{ background: "#1A1815", minHeight: "100vh" }} />}>
      <CallLivePageClient />
    </Suspense>
  );
}

