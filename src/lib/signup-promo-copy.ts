import { CREDIT_FREE_TRIAL_VALID_DAYS, CREDIT_SIGNUP_GRANT, formatCreditsKo } from "@/lib/credit-policy";

export const SIGNUP_PROMO_NOTICE_SLUG = "launch-signup-5000-credits";

export type SignupPromoContext = "home" | "meet" | "fortune" | "default";

export function resolveSignupPromoContext(pathname: string): SignupPromoContext | null {
  const p = pathname || "/";
  if (
    p.startsWith("/admin") ||
    p.startsWith("/auth") ||
    p.startsWith("/checkout") ||
    p.startsWith("/payment") ||
    p.startsWith("/legal")
  ) {
    return null;
  }
  if (p === "/my" || p.startsWith("/my/")) return null;

  if (p === "/meet" || p.startsWith("/call")) return "meet";
  if (p.startsWith("/fortune")) return "fortune";
  if (p === "/" || p === "/today" || p === "/content" || p.startsWith("/content/")) return "home";
  return "default";
}

export function signupPromoCopy(context: SignupPromoContext) {
  const credits = formatCreditsKo(CREDIT_SIGNUP_GRANT);
  const contextLine: Record<SignupPromoContext, string> = {
    home: "지금 가입하면 크레딧으로 바로 음성·점사를 시작할 수 있어요.",
    meet: "3분 무료 체험 후 이어가려면 가입하세요. 가입 즉시 크레딧이 지급됩니다.",
    fortune: "점사 결과 저장·이어 보기는 가입 후 가능해요. 가입 시 크레딧을 드립니다.",
    default: "카드 등록 없이 음성 상담·점사에 바로 쓸 수 있어요.",
  };

  return {
    eyebrow: "런칭 기념",
    title: `가입하면 ${credits} 크레딧`,
    subtitle: `(${credits}원 상당 · 가입 후 ${CREDIT_FREE_TRIAL_VALID_DAYS}일 이내 사용)`,
    contextLine: contextLine[context],
    noticeHref: `/notices/${SIGNUP_PROMO_NOTICE_SLUG}`,
  };
}
