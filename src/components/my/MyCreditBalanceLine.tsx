"use client";

import { useCallback, useEffect, useState } from "react";

import { spendableTotalCredits, YEONUN_CREDIT_UPDATE_EVENT } from "@/lib/credit-balance-local";

/** 마이 메뉴「크레딧 충전」보조 설명 — 잔여 크레딧 */
export function MyCreditBalanceLine() {
  const [text, setText] = useState("현재 잔여 —");

  const refresh = useCallback(() => {
    try {
      const n = spendableTotalCredits();
      setText(`현재 잔여 ${n.toLocaleString("ko-KR")} 크레딧`);
    } catch {
      setText("현재 잔여 0 크레딧");
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(YEONUN_CREDIT_UPDATE_EVENT, refresh);
    return () => window.removeEventListener(YEONUN_CREDIT_UPDATE_EVENT, refresh);
  }, [refresh]);

  return <>{text}</>;
}
