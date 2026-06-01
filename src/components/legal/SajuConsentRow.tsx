"use client";

type Variant = "self" | "partner";

const COPY: Record<Variant, string> = {
  self: "[필수] 사주 풀이를 위해 입력 정보를 수집·이용하는 것에 동의합니다",
  partner: "[필수] 상대방 정보는 궁합 풀이 목적으로만 이용합니다",
};

type Props = {
  variant?: Variant;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export function SajuConsentRow({ variant = "self", checked, onChange, className }: Props) {
  return (
    <label className={className ?? "y-auth-consent-row y-saju-consent-row"}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {COPY[variant]}{" "}
        <a href="/legal/privacy#saju" target="_blank" rel="noopener noreferrer">
          자세히
        </a>
      </span>
    </label>
  );
}
