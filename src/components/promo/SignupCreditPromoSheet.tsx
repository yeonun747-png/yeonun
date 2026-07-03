"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type MouseEvent } from "react";

import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";
import { hasStorageNoticeAck } from "@/lib/client-consent-storage";
import { resolveSignupPromoContext, signupPromoCopy } from "@/lib/signup-promo-copy";
import {
  canShowSignupPromo,
  dismissSignupPromoForWeek,
  markSignupPromoSessionShown,
} from "@/lib/signup-promo-storage";

const SHOW_AFTER_STORAGE_ACK_MS = 1500;
const SHOW_AFTER_READY_MS = 4000;

function stopSheetPointerBubble(e: MouseEvent) {
  e.stopPropagation();
}

export function SignupCreditPromoSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { user, loading } = useYeonunAuth();
  const [open, setOpen] = useState(false);
  const [bodyModalOpen, setBodyModalOpen] = useState(false);

  const context = resolveSignupPromoContext(pathname);
  const modalOpen = Boolean(sp.get("modal"));
  const copy = context ? signupPromoCopy(context) : null;
  const visible = open && !!copy && !modalOpen;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => {
      setBodyModalOpen(
        Boolean(document.body.querySelector(":scope > .y-modal.open:not(.y-signup-promo-modal)")),
      );
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (open) markSignupPromoSessionShown();
  }, [open]);

  useEffect(() => {
    if (loading || user || !context || !copy) return;
    router.prefetch(copy.noticeHref);
  }, [loading, user, context, copy, router]);

  useEffect(() => {
    if (loading || user || !context || !copy) {
      setOpen(false);
      return;
    }
    if (modalOpen || bodyModalOpen || !canShowSignupPromo()) return;

    let cancelled = false;
    let timer = 0;

    const show = () => {
      if (cancelled || loading || user || modalOpen || bodyModalOpen || !canShowSignupPromo()) return;
      if (!hasStorageNoticeAck()) return;
      setOpen(true);
    };

    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(show, ms);
    };

    const onStorageAck = () => schedule(SHOW_AFTER_STORAGE_ACK_MS);

    if (hasStorageNoticeAck()) {
      schedule(SHOW_AFTER_READY_MS);
    } else {
      window.addEventListener("yeonun:storage-notice-acked", onStorageAck);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("yeonun:storage-notice-acked", onStorageAck);
    };
  }, [loading, user, context, copy, modalOpen, bodyModalOpen, pathname]);

  const closeSession = useCallback(() => {
    markSignupPromoSessionShown();
    setOpen(false);
  }, []);

  const closeWeek = useCallback(() => {
    dismissSignupPromoForWeek();
    setOpen(false);
  }, []);

  const openAuth = useCallback(() => {
    markSignupPromoSessionShown();
    const qs = new URLSearchParams(sp.toString());
    qs.set("modal", "auth");
    const next = qs.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, sp]);

  const openNotice = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      markSignupPromoSessionShown();
      router.push(copy!.noticeHref);
    },
    [copy, router],
  );

  if (!visible) return null;

  return (
    <YeonunSheetPortal>
      <div
        className="y-modal open y-signup-promo-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-promo-title"
        onMouseDown={closeSession}
      >
        <div className="y-modal-sheet y-signup-promo-sheet" onMouseDown={stopSheetPointerBubble} onClick={stopSheetPointerBubble}>
          <div className="y-modal-handle" />
          <div className="y-signup-promo-body">
            <div className="y-signup-promo-eyebrow">{copy.eyebrow}</div>
            <h2 id="signup-promo-title" className="y-signup-promo-title">
              {copy.title}
            </h2>
            <p className="y-signup-promo-sub">{copy.subtitle}</p>
            <p className="y-signup-promo-context">{copy.contextLine}</p>
            <p className="y-signup-promo-hint">카드 등록 없이 음성 상담·점사에 바로 사용할 수 있어요.</p>
            <button type="button" className="y-signup-promo-cta" onClick={openAuth}>
              3초 만에 가입하기
            </button>
            <a href={copy.noticeHref} className="y-signup-promo-link" onClick={openNotice}>
              혜택 자세히 보기
            </a>
            <button type="button" className="y-signup-promo-dismiss" onClick={closeWeek}>
              오늘은 그냥 볼게요
            </button>
          </div>
        </div>
      </div>
    </YeonunSheetPortal>
  );
}
