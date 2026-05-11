/**
 * 어드민은 서버에서 Supabase를 직접 조회합니다.
 * 프로덕션에서 기본 정적·페치 캐시에 걸리면 저장 직후에도 이전 RSC 스냅샷이
 * 새로고침에 재사용될 수 있어, `/admin` 전체를 항상 동적으로 렌더링합니다.
 */
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
