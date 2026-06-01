"use client";

import { useState } from "react";

import { MyInquiryModal } from "@/components/my/MyInquiryModal";

export function MyInquiryMenuItemClient() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="y-my-menu-item" onClick={() => setOpen(true)} aria-label="문의하기">
        <div className="y-my-menu-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="y-my-menu-text">
          <div className="y-my-menu-name">문의하기</div>
          <div className="y-my-menu-desc">이름·이메일·문의내용 접수</div>
        </div>
        <span className="y-my-menu-arrow">›</span>
      </button>
      {open ? <MyInquiryModal onDismiss={() => setOpen(false)} /> : null}
    </>
  );
}
