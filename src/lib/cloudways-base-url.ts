/**
 * Cloudways Nginx: 공개 `https://호스트/chat` → 내부 Node `http://127.0.0.1:3000/chat`.
 * 환경 변수에는 스킴+호스트만 두는 것을 권장합니다(끝 `/` 없음, `/chat` 접미사 없음).
 * 실수로 `/chat` 까지 넣은 경우 제거해 `…/chat` + `/chat` 중복을 막습니다.
 */
export function normalizeCloudwaysBaseUrl(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat$/i, "");
}
