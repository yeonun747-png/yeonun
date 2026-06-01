"use client";

import { useCallback, useState } from "react";

import { setSessionLegalConsent } from "@/lib/client-consent-storage";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
  className?: string;
};

export function AuthLegalConsentRow({ checked, onChange, onOpenTerms, onOpenPrivacy, className }: Props) {
  const toggle = useCallback(() => {
    const next = !checked;
    onChange(next);
    if (next) setSessionLegalConsent();
  }, [checked, onChange]);

  const termsEl =
    onOpenTerms != null ? (
      <button
        type="button"
        className="y-pay-terms-link"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenTerms();
        }}
      >
        이용약관
      </button>
    ) : (
      <a href="/legal/terms">이용약관</a>
    );

  const privacyEl =
    onOpenPrivacy != null ? (
      <button
        type="button"
        className="y-pay-terms-link"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenPrivacy();
        }}
      >
        개인정보처리방침
      </button>
    ) : (
      <a href="/legal/privacy">개인정보처리방침</a>
    );

  return (
    <label className={className ?? "y-auth-consent-row"}>
      <input type="checkbox" checked={checked} onChange={() => toggle()} />
      <span>
        [필수] 만 14세 이상이며, {termsEl}·{privacyEl}에 동의합니다
      </span>
    </label>
  );
}

export function useAuthLegalConsent(initial = false) {
  const [checked, setChecked] = useState(initial);
  return { legalConsentChecked: checked, setLegalConsentChecked: setChecked };
}
