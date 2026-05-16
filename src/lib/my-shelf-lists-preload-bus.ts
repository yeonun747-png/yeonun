type WarmFn = () => void;

let warmFn: WarmFn | null = null;

/** 마이 탭에서 점사·음성 보관함 목록 선로딩을 시작합니다(멤버일 때만 동작). */
export function registerMyShelfListsWarm(fn: WarmFn | null) {
  warmFn = fn;
}

export function myShelfListsWarm() {
  warmFn?.();
}
