"use client";

import Link from "next/link";
import { useState } from "react";

import { LegalInlineSheet } from "@/components/legal/LegalInlineSheet";
import { PrivacyDocContent, TermsDocContent } from "@/components/legal/LegalDocContent";

export type PayTermsState = {
  agreeAll: boolean;
  agreePayTerms: boolean;
  agreeCommerceTerms: boolean;
  allChecked: boolean;
};

type LinkTarget = { pathname: string; query: Record<string, string> };

export function usePayTermsState(initial = false) {
  const [agreeAll, setAgreeAll] = useState(initial);
  const [agreePayTerms, setAgreePayTerms] = useState(initial);
  const [agreeCommerceTerms, setAgreeCommerceTerms] = useState(initial);
  const allChecked = agreePayTerms && agreeCommerceTerms;

  const toggleAll = () => {
    const next = !(agreeAll && allChecked);
    setAgreeAll(next);
    setAgreePayTerms(next);
    setAgreeCommerceTerms(next);
  };

  const togglePay = () => {
    const next = !agreePayTerms;
    setAgreePayTerms(next);
    setAgreeAll(next && agreeCommerceTerms);
  };

  const toggleCommerce = () => {
    const next = !agreeCommerceTerms;
    setAgreeCommerceTerms(next);
    setAgreeAll(agreePayTerms && next);
  };

  return {
    agreeAll,
    agreePayTerms,
    agreeCommerceTerms,
    allChecked,
    toggleAll,
    togglePay,
    toggleCommerce,
  };
}

type Props = {
  agreeAll: boolean;
  agreePayTerms: boolean;
  agreeCommerceTerms: boolean;
  onToggleAll: () => void;
  onTogglePay: () => void;
  onToggleCommerce: () => void;
  legalMode?: "inline-sheet" | "link";
  legalTermsHref?: LinkTarget;
  legalPrivacyHref?: LinkTarget;
  onRememberSheetScroll?: () => void;
};

export function PayTermsBlock({
  agreeAll,
  agreePayTerms,
  agreeCommerceTerms,
  onToggleAll,
  onTogglePay,
  onToggleCommerce,
  legalMode = "inline-sheet",
  legalTermsHref,
  legalPrivacyHref,
  onRememberSheetScroll,
}: Props) {
  const allChecked = agreePayTerms && agreeCommerceTerms;
  const [legalSheet, setLegalSheet] = useState<"terms" | "privacy" | null>(null);

  const termsLink =
    legalMode === "link" && legalTermsHref ? (
      <Link
        href={legalTermsHref}
        scroll={false}
        onClick={(e) => {
          e.stopPropagation();
          onRememberSheetScroll?.();
        }}
      >
        이용약관
      </Link>
    ) : (
      <button type="button" className="y-pay-terms-link" onClick={(e) => { e.stopPropagation(); setLegalSheet("terms"); }}>
        이용약관
      </button>
    );

  const privacyLink =
    legalMode === "link" && legalPrivacyHref ? (
      <Link
        href={legalPrivacyHref}
        scroll={false}
        onClick={(e) => {
          e.stopPropagation();
          onRememberSheetScroll?.();
        }}
      >
        개인정보처리방침
      </Link>
    ) : (
      <button type="button" className="y-pay-terms-link" onClick={(e) => { e.stopPropagation(); setLegalSheet("privacy"); }}>
        개인정보처리방침
      </button>
    );

  return (
    <>
      <div className="y-pay-terms" aria-label="약관 동의">
        <div
          className={`y-pay-terms-row ${agreeAll && allChecked ? "checked" : ""}`}
          role="checkbox"
          aria-checked={Boolean(agreeAll && allChecked)}
          tabIndex={0}
          onClick={onToggleAll}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleAll(); } }}
        >
          <div className="y-pay-terms-check" aria-hidden="true">✓</div>
          <div className="text"><strong style={{ color: "var(--y-ink)" }}>전체 동의</strong></div>
        </div>
        <div
          className={`y-pay-terms-row ${agreePayTerms ? "checked" : ""}`}
          role="checkbox"
          aria-checked={Boolean(agreePayTerms)}
          tabIndex={0}
          onClick={onTogglePay}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTogglePay(); } }}
        >
          <div className="y-pay-terms-check" aria-hidden="true">✓</div>
          <div className="text">[필수] {termsLink} 동의</div>
        </div>
        <div
          className={`y-pay-terms-row ${agreeCommerceTerms ? "checked" : ""}`}
          role="checkbox"
          aria-checked={Boolean(agreeCommerceTerms)}
          tabIndex={0}
          onClick={onToggleCommerce}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleCommerce(); } }}
        >
          <div className="y-pay-terms-check" aria-hidden="true">✓</div>
          <div className="text">[필수] {privacyLink} 동의</div>
        </div>
      </div>
      {legalMode === "inline-sheet" && legalSheet === "terms" ? (
        <LegalInlineSheet title="이용약관" ariaLabel="이용약관" onClose={() => setLegalSheet(null)}>
          <TermsDocContent />
        </LegalInlineSheet>
      ) : null}
      {legalMode === "inline-sheet" && legalSheet === "privacy" ? (
        <LegalInlineSheet title="개인정보처리방침" ariaLabel="개인정보처리방침" onClose={() => setLegalSheet(null)}>
          <PrivacyDocContent />
        </LegalInlineSheet>
      ) : null}
    </>
  );
}
