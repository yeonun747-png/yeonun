"use client";

import { Suspense } from "react";

import { MyPageBody } from "@/components/my/MyPageBody";

export default function MyPage() {
  return (
    <Suspense fallback={<div className="yeonunPage" style={{ minHeight: "50vh" }} />}>
      <MyPageBody />
    </Suspense>
  );
}
