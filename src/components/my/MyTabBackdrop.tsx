import { MySheetBackdropFrame } from "@/components/my/MySheetBackdropFrame";

/**
 * 마이 탭에서 열리는 라우트형 바텀시트의 블러 백드롭.
 * 시트는 body 포털로 렌더링되므로, 뒤에 실제 마이 화면이 있어야 목업처럼 블러가 보인다.
 */
export function MyTabBackdrop() {
  return <MySheetBackdropFrame />;
}
