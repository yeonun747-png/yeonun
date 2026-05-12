import { Suspense } from "react";
import type { Metadata } from "next";

import CallDccPageClient from "./CallDccPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "VOICE FAST | 연운",
  description: "OpenAI gpt-realtime-2 · WebRTC 음성 상담.",
  alternates: { canonical: "/call-dcc" },
  robots: { index: false, follow: false },
};

export default function CallDccPage() {
  return (
    <Suspense fallback={<div className="yeonunPage" style={{ background: "#1A1815", minHeight: "100vh" }} />}>
      <CallDccPageClient />
    </Suspense>
  );
}

