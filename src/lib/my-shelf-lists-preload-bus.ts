type WarmFn = () => void;

let warmFn: WarmFn | null = null;
let forceFortuneRefresh = false;

/** 마이 탭에서 점사·음성 보관함 목록 선로딩을 시작합니다(멤버일 때만 동작). */
export function registerMyShelfListsWarm(fn: WarmFn | null) {
  warmFn = fn;
}

export function myShelfListsWarm() {
  warmFn?.();
}

/** 보관함 저장 직후·시트 오픈 시 목록을 다시 불러옵니다. */
export function requestMyShelfFortuneListRefresh() {
  forceFortuneRefresh = true;
  warmFn?.();
}

export function consumeForceFortuneListRefresh(): boolean {
  const v = forceFortuneRefresh;
  forceFortuneRefresh = false;
  return v;
}
