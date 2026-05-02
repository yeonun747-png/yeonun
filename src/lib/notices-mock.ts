export type NoticeBadge = "event" | "update" | "notice";

export type NoticeMock = {
  id: string;
  badge: NoticeBadge;
  title: string;
  date: string;
  bodyHtml: string;
  showNewDot?: boolean;
};

export const NOTICES_MOCK: NoticeMock[] = [
  {
    id: "1",
    badge: "event",
    title: "2026 신년 특별 이벤트 — 평생사주 20% 할인",
    date: "2026.01.01",
    showNewDot: true,
    bodyHtml: `<p>안녕하세요. 연운입니다.</p><p>새해를 맞이하여 평생사주 풀이를 특별 할인 가격으로 제공합니다.</p><p><strong>이벤트 기간:</strong> 2026년 1월 1일 ~ 1월 31일</p><p><strong>할인 대상:</strong> 평생사주 (49,900원 → 39,920원)</p><p>병오(丙午)년을 맞아 여연 선생님이 정성을 다해 작성한 30,000자 분량의 풀이를 이번 기회에 받아보시기 바랍니다.</p><p>감사합니다.</p>`,
  },
  {
    id: "2",
    badge: "update",
    title: "운서 안내자 작명 서비스 정식 오픈",
    date: "2026.02.14",
    showNewDot: true,
    bodyHtml: `<p>운서 안내자의 작명 서비스가 정식 오픈되었습니다.</p><p>자세한 이용 방법은 풀이 메뉴에서 확인해 주세요.</p>`,
  },
  {
    id: "3",
    badge: "notice",
    title: "결제 수단 코인 결제(Fortune82) 추가 안내",
    date: "2026.03.10",
    showNewDot: true,
    bodyHtml: `<p>코인 결제(Fortune82) 수단이 추가되었습니다.</p><p>결제 시 수단 선택 화면에서 이용 가능합니다.</p>`,
  },
  {
    id: "4",
    badge: "event",
    title: "봄맞이 절기 이벤트 — 꿈해몽 무료 체험",
    date: "2026.03.20",
    bodyHtml: `<p>절기 이벤트로 꿈해몽 무료 체험을 제공합니다.</p><p>기간 내 1회 한정입니다.</p>`,
  },
  {
    id: "5",
    badge: "notice",
    title: "연운 서비스 이용약관 개정 안내 (2026.04.01 시행)",
    date: "2026.03.28",
    bodyHtml: `<p>이용약관이 개정되었습니다.</p><p>시행일: 2026년 4월 1일</p><p>전문은 이용약관 페이지에서 확인해 주세요.</p>`,
  },
];

export function getNoticeById(id: string): NoticeMock | undefined {
  return NOTICES_MOCK.find((n) => n.id === id);
}
