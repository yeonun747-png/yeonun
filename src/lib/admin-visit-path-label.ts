const EXACT_PATH_LABELS: Record<string, string> = {
  "/": "홈탭",
  "/my": "마이탭",
  "/meet": "만남탭",
  "/today": "오늘의 한마디",
  "/content": "콘텐츠 탭",
  "/call": "음성 상담",
  "/call-dcc": "음성 상담 (DCC)",
  "/call-live": "음성 상담 (라이브)",
  "/support": "고객센터",
  "/auth": "로그인",
  "/auth/complete": "로그인 완료",
  "/library": "점사 보관함",
  "/reviews": "리뷰",
  "/notices": "공지사항",
  "/search": "검색",
  "/invite": "초대",
  "/partner": "파트너",
  "/beta": "베타",
  "/history/calls": "음성 상담 기록",
  "/history/chats": "채팅 기록",
  "/my/payments": "구매 내역",
  "/my/credit-usage": "크레딧 사용 내역",
  "/checkout/credit": "크레딧 충전",
  "/checkout/credit/payment": "크레딧 결제",
  "/payment/success": "결제 성공",
  "/payment/error": "결제 실패",
  "/legal/terms": "이용약관",
  "/legal/privacy": "개인정보처리방침",
  "/company/about": "회사 소개",
  "/settings/notifications": "알림 설정",
};

const PREFIX_PATH_LABELS: { prefix: string; label: string }[] = [
  { prefix: "/fortune/", label: "점사" },
  { prefix: "/characters/", label: "캐릭터 상세" },
  { prefix: "/content/", label: "콘텐츠 상세" },
  { prefix: "/notices/", label: "공지 상세" },
  { prefix: "/library/", label: "보관함 상세" },
  { prefix: "/history/calls/", label: "음성 기록 상세" },
  { prefix: "/history/chats/", label: "채팅 기록 상세" },
  { prefix: "/today/share/", label: "오늘의 한마디 공유" },
];

const PROVIDER_LABEL: Record<string, string> = {
  google: "구글",
  kakao: "카카오",
  naver: "네이버",
};

export function normalizeVisitPath(path: string): string {
  const p = String(path ?? "").trim();
  return p || "/";
}

export function labelForVisitPath(path: string): string {
  const p = normalizeVisitPath(path);
  if (EXACT_PATH_LABELS[p]) return EXACT_PATH_LABELS[p];

  for (const { prefix, label } of PREFIX_PATH_LABELS) {
    if (!p.startsWith(prefix)) continue;
    const rest = p.slice(prefix.length).replace(/\/$/, "");
    if (!rest) return label;
    if (prefix === "/fortune/") return `점사 · ${rest}`;
    return `${label} · ${rest}`;
  }

  return p;
}

export function providerLabel(provider: string | null | undefined): string {
  if (!provider) return "";
  return PROVIDER_LABEL[provider] ?? provider;
}

export function formatGuestVisitorLabel(visitorRef: string): string {
  const ref = String(visitorRef ?? "").trim();
  const token = ref.replace(/^visitor_/i, "").slice(0, 8) || ref.slice(-8) || "unknown";
  return `비회원 · ${token}`;
}
