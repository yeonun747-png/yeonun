import type { SocialProvider } from "@/lib/auth/types";

type IconProps = {
  className?: string;
};

/** 카카오톡 말풍선 심볼 (노란 버튼 위) */
export function KakaoIcon({ className }: IconProps) {
  return (
    <svg className={className} width={18} height={18} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        fill="#371D1E"
        d="M9 1.5C4.86 1.5 1.5 4.28 1.5 7.65c0 2.13 1.4 4.01 3.53 5.13L3.75 15.75l2.8-1.54c.68.19 1.4.29 2.1.29 4.14 0 7.5-2.78 7.5-6.15S13.14 1.5 9 1.5z"
      />
    </svg>
  );
}

/** 네이버 로그인 아이콘 — public/logo/naver.png */
export function NaverIcon({ className }: IconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src="/logo/naver.png" alt="" width={18} height={18} decoding="async" />
  );
}

/** Google G (컬러) */
export function GoogleIcon({ className }: IconProps) {
  return (
    <svg className={className} width={18} height={18} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92a8.78 8.78 0 0 0 2.68-6.61z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.16.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.54 0 2.51 2.18.96 5.04l3.01 2.33C4.68 5.42 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

export function SocialProviderIcon({ provider, className }: { provider: SocialProvider; className?: string }) {
  if (provider === "kakao") return <KakaoIcon className={className} />;
  if (provider === "naver") return <NaverIcon className={className} />;
  return <GoogleIcon className={className} />;
}
