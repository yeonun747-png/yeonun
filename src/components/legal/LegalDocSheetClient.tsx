"use client";

import type { ReactNode } from "react";

import { MySubpageSheet } from "@/components/my/MySubpageSheet";

type Props = {
  title: string;
  ariaLabel: string;
  backHref: string;
  useHistoryBack?: boolean;
  children: ReactNode;
};

/** 이용약관·환불 등 — 고객센터/마이 등 상위 시트로 돌아가기 */
export function LegalDocSheetClient({ title, ariaLabel, backHref, useHistoryBack = false, children }: Props) {
  return (
    <MySubpageSheet title={title} ariaLabel={ariaLabel} backHref={backHref} useHistoryBack={useHistoryBack}>
      <div className="y-sub-scroll-page">{children}</div>
    </MySubpageSheet>
  );
}
