import "server-only";

import { revalidatePath } from "next/cache";

/** 어드민 리뷰 저장·노출 변경 후 프론트 목록 갱신 */
export function revalidateReviewPages() {
  revalidatePath("/", "layout");
  revalidatePath("/reviews");
  revalidatePath("/characters", "layout");
  revalidatePath("/content", "layout");
}
