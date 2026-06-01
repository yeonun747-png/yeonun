export type SocialProvider = "google" | "kakao" | "naver";

export type OAuthProfile = {
  provider: SocialProvider;
  providerId: string;
  name: string;
  email: string | null;
  profileImage: string | null;
};

export type OAuthStatePayload = {
  state: string;
  returnTo: string;
  provider: SocialProvider;
  exp: number;
  /** 로그인 시작 시 약관·개인정보 필수 동의 완료 */
  termsAccepted?: boolean;
  /** 로그인 중 다른 소셜 연동 */
  mode?: "link";
  linkToAuthUserId?: string;
};
