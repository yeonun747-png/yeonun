"use client";

import { useState } from "react";

import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import { MyWithdrawConfirmModal } from "@/components/my/MyWithdrawConfirmModal";

export function MyWithdrawAccountMenuItemClient({ placement = "menu" }: { placement?: "menu" | "foot" }) {
  const { user } = useYeonunAuth();
  const [modalOpen, setModalOpen] = useState(false);

  if (!user) return null;

  const openModal = () => setModalOpen(true);

  const content =
    placement === "foot" ? (
      <div className="y-my-withdraw-foot">
        <button
          type="button"
          className="y-my-withdraw-foot-btn"
          onClick={openModal}
          aria-label="회원 탈퇴"
        >
          회원 탈퇴
        </button>
        <p className="y-my-withdraw-foot-desc">30일 후 계정·연결 정보 완전 삭제</p>
      </div>
    ) : (
      <button
        type="button"
        className="y-my-menu-item y-my-menu-item--danger"
        onClick={openModal}
        aria-label="회원 탈퇴"
      >
        <div className="y-my-menu-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </div>
        <div className="y-my-menu-text">
          <div className="y-my-menu-name">회원 탈퇴</div>
          <div className="y-my-menu-desc">30일 후 계정·연결 정보 완전 삭제</div>
        </div>
        <span className="y-my-menu-arrow">›</span>
      </button>
    );

  return (
    <>
      {content}
      {modalOpen ? <MyWithdrawConfirmModal onDismiss={() => setModalOpen(false)} /> : null}
    </>
  );
}
