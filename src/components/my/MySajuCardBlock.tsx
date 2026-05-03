"use client";

import { Suspense } from "react";

import { MySajuCardClient } from "@/components/my/MySajuCardClient";

export function MySajuCardBlock() {
  return (
    <Suspense fallback={null}>
      <MySajuCardClient />
    </Suspense>
  );
}
