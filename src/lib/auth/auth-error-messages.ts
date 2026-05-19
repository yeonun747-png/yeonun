import type { SocialProvider } from "@/lib/auth/types";

const PROVIDER_LABEL: Record<SocialProvider, string> = {
  google: "Google",
  kakao: "카카오",
  naver: "네이버",
};

function withHint(base: string, hint: string | null | undefined): string {
  const h = hint?.trim();
  if (!h) return base;
  return `${base}\n${h}`;
}

export function authErrorMessage(
  code: string | null,
  existingProvider?: string | null,
  hint?: string | null,
): string | null {
  if (!code) return null;
  switch (code) {
    case "cancelled":
      return "로그인이 취소되었습니다.";
    case "oauth_not_configured":
      return "소셜 로그인 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.";
    case "oauth_redirect_mismatch":
      return withHint(
        "로그인 redirect URI가 일치하지 않습니다. 카카오·구글 콘솔에 https://yeonun.com/auth/callback/… 가 등록돼 있는지 확인해 주세요.",
        hint,
      );
    case "oauth_invalid_client":
      return withHint(
        "소셜 앱 Client ID·Secret이 올바르지 않습니다. Vercel Production env와 개발자 콘솔 설정을 확인해 주세요.",
        hint,
      );
    case "invalid_state":
      return withHint(
        "로그인 요청이 만료되었습니다. 시크릿 창이 아닌 일반 브라우저에서 다시 시도해 주세요.",
        hint,
      );
    case "session_failed":
      return withHint("세션 발급에 실패했습니다. 잠시 후 다시 시도해 주세요.", hint);
    case "token_failed":
      return withHint("로그인에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.", hint);
    case "email_provider_conflict": {
      const p = existingProvider as SocialProvider | undefined;
      const label = p && PROVIDER_LABEL[p] ? PROVIDER_LABEL[p] : "다른 소셜";
      return `이미 ${label} 계정으로 가입되어 있습니다. 해당 방법으로 로그인해 주세요.`;
    }
    case "withdrawal_pending":
      return "탈퇴 처리 중인 계정입니다. 30일 이후 재가입하거나 고객센터로 문의해 주세요.";
    case "link_failed":
      return "로그인 연동에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    default:
      return withHint("로그인 중 문제가 발생했습니다.", hint);
  }
}

const PROVIDER_LABEL_KO: Record<SocialProvider, string> = {
  google: "Google",
  kakao: "카카오",
  naver: "네이버",
};

export function socialLinkErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "cancelled":
      return "연동이 취소되었습니다.";
    case "invalid_state":
      return "연동 요청이 만료되었습니다. 다시 시도해 주세요.";
    case "withdrawal_pending":
      return "탈퇴 처리 중인 계정은 연동할 수 없습니다.";
    case "link_failed":
      return "로그인 연동에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    case "link_disabled":
      return "Google·카카오·네이버는 각각 별도 로그인으로 이용해 주세요. 로그아웃 후 원하는 방법으로 다시 로그인하세요.";
    default:
      return "연동 중 문제가 발생했습니다.";
  }
}

export function socialLinkSuccessMessage(provider: string | null): string | null {
  if (!provider) return null;
  const p = provider as SocialProvider;
  const label = PROVIDER_LABEL_KO[p] ?? provider;
  return `${label} 로그인 정보가 확인되었습니다.`;
}
