"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ackStorageNotice, hasStorageNoticeAck } from "@/lib/client-consent-storage";

export function StorageNoticeBanner() {
  const sp = useSearchParams();
  const modalOpen = Boolean(sp.get("modal"));
  const [visible, setVisible] = useState(false);
  const [bodyModalOpen, setBodyModalOpen] = useState(false);

  useEffect(() => {
    setVisible(!hasStorageNoticeAck());
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => setBodyModalOpen(Boolean(document.body.querySelector(":scope > .y-modal.open")));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  if (!visible || modalOpen || bodyModalOpen) return null;

  return (
    <div className="y-storage-notice" role="region" aria-label="저장소 안내">
      <p>
        연운은 서비스 제공을 위해 필수 쿠키·기기 저장소를 사용합니다.{" "}
        <Link href="/legal/privacy#storage">자세히</Link>
      </p>
      <button
        type="button"
        className="y-storage-notice-btn"
        onClick={() => {
          ackStorageNotice();
          setVisible(false);
        }}
      >
        확인
      </button>
    </div>
  );
}
