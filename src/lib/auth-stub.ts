/**
 * 소셜 OAuth 도입 전: 소셜 버튼 탭 시 로그인된 것으로 간주하기 위한 임시 플래그.
 * 실제 Supabase 세션이 없어도 클라이언트에서 "로그인됨" UI를 맞출 때 사용.
 */
export const YEONUN_AUTH_STUB_KEY = "yeonun_auth_stub_v1";
export const YEONUN_AUTH_STUB_EVENT = "yeonun:auth-stub-updated";

export function readAuthStubLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(YEONUN_AUTH_STUB_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAuthStubLoggedIn(): void {
  try {
    window.localStorage.setItem(YEONUN_AUTH_STUB_KEY, "1");
    window.dispatchEvent(new Event(YEONUN_AUTH_STUB_EVENT));
  } catch {
    // ignore
  }
}
