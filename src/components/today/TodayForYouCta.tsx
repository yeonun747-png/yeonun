"use client";

import { useEffect, useLayoutEffect, useState } from "react";

import Link from "next/link";

import { __YEONUN_SAJU_STORAGE_KEY__ } from "@/components/my/MySajuCardClient";

const SAJU_UPDATED = "yeonun:saju-updated";

function readHasValidSaju(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(__YEONUN_SAJU_STORAGE_KEY__);
    if (!raw) return false;
    const j = JSON.parse(raw) as { year?: string; month?: string; day?: string };
    return !!(j?.year && j?.month && j?.day);
  } catch {
    return false;
  }
}

/** 사주 미입력일 때만 FOR YOU 카드 표시 */
export function TodayForYouCta() {
  const [show, setShow] = useState(false);

  const sync = () => setShow(readHasValidSaju() === false);

  useLayoutEffect(() => {
    sync();
  }, []);

  useEffect(() => {
    const on = () => sync();
    window.addEventListener(SAJU_UPDATED, on as EventListener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === __YEONUN_SAJU_STORAGE_KEY__) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SAJU_UPDATED, on as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="y-today-for-you" aria-label="사주 입력 안내">
      <div className="y-today-for-you-eyebrow">FOR YOU · 오늘 당신만의 운세</div>
      <p className="y-today-for-you-title">사주를 한 번 입력하면 매일이 달라집니다</p>
      <p className="y-today-for-you-desc">4명의 인연 안내자가 당신의 사주에 맞춰 매일 한 마디를 보냅니다.</p>
      <Link className="y-today-for-you-btn" href="/my?modal=saju">
        사주 입력하고 시작하기
      </Link>
      <p className="y-today-for-you-foot">
        이미 회원이신가요?{" "}
        <Link href="/my?modal=auth" className="y-today-for-you-link">
          로그인
        </Link>
      </p>
    </div>
  );
}
