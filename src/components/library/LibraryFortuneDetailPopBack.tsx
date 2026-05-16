"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 보관함 점사 상세(`/library/[requestId]`)에서 단말·브라우저 뒤로가기(popstate) 시
 * 이전 히스토리 대신 마이의 점사 보관함 시트로 보낸다.
 */
export function LibraryFortuneDetailPopBack() {
  const router = useRouter();

  useEffect(() => {
    const onPopState = () => {
      router.replace("/my?shelf=fortune");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);

  return null;
}
