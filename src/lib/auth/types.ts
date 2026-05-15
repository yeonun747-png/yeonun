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
};
