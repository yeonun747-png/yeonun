"use client";

import { useEffect, useState } from "react";

import { readVoiceBalanceSecClient } from "@/lib/voice-balance-local";

/** 마이 메뉴「크레딧 충전」보조 설명 — 음성 잔여 시간(초) */
export function MyCreditBalanceLine() {
  const [text, setText] = useState("현재 잔여 —");

  useEffect(() => {
    try {
      const sec = readVoiceBalanceSecClient();
      const n = Number.isFinite(sec) ? Math.max(0, sec) : 0;
      const m = Math.floor(n / 60);
      const s = n % 60;
      setText(`현재 잔여 ${m}분 ${s}초`);
    } catch {
      setText("현재 잔여 0분");
    }
  }, []);

  return <>{text}</>;
}
