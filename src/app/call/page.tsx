import { Suspense } from "react";
import CallPageClient from "./CallPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CallPage() {
  return (
    <Suspense fallback={<div className="yeonunPage" style={{ background: "#1A1815", minHeight: "100vh" }} />}>
      <CallPageClient />
    </Suspense>
  );
}
