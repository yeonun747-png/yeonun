import { invalidateFortuneListCache } from "@/lib/my-shelf-lists-cache";
import { requestMyShelfFortuneListRefresh } from "@/lib/my-shelf-lists-preload-bus";

/** 점사 보관함 저장 성공 후 마이 탭 목록 캐시 무효화·재조회 */
export function notifyFortuneLibrarySaved(userId: string) {
  const uid = String(userId ?? "").trim();
  if (!uid) return;
  invalidateFortuneListCache(uid);
  requestMyShelfFortuneListRefresh();
}
