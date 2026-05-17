/** 점사 플로우: 모바일 키보드 닫기 + 스크롤 원복(마스코트 좌표 틀어짐 방지) */
export function dismissFortuneSoftKeyboard(): void {
  const ae = document.activeElement;
  if (ae instanceof HTMLElement) ae.blur();
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  const stage = document.querySelector<HTMLElement>(".y-fortune-v2-stage");
  stage?.scrollTo?.({ top: 0, behavior: "auto" });
}
