import type { SocialProvider } from "@/lib/auth/types";

const PROVIDER_LABEL: Record<SocialProvider, string> = {
  google: "Google",
  kakao: "카카오",
  naver: "네이버",
};

export function authErrorMessage(
  code: string | null,
  existingProvider?: string | null,
): string | null {
  if (!code) return null;
  switch (code) {
    case "cancelled":
      return "로그인이 취소되었습니다.";
    case "oauth_not_configured":
      return "소셜 로그인 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.";
    case "invalid_state":
      return "로그인 요청이 만료되었습니다. 다시 시도해 주세요.";
    case "token_failed":
      return "로그인에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.";
    case "email_provider_conflict": {
      const p = existingProvider as SocialProvider | undefined;
      const label = p && PROVIDER_LABEL[p] ? PROVIDER_LABEL[p] : "다른 소셜";
      return `이미 ${label} 계정으로 가입되어 있습니다. 해당 방법으로 로그인해 주세요.`;
    }
    case "withdrawal_pending":
      return "탈퇴 처리 중인 계정입니다. 30일 이후 재가입하거나 고객센터로 문의해 주세요.";
    default:
      return "로그인 중 문제가 발생했습니다.";
  }
}
