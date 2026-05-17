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
  /** 로그인 중 다른 소셜 연동 */
  mode?: "link";
  linkToAuthUserId?: string;
};
