import { LibraryListScreenClient } from "@/components/library/LibraryListScreenClient";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";

export const metadata = {
  title: "점사 보관함 | 연운 緣運",
  description: "저장한 점사 풀이를 다시 열람합니다.",
  robots: { index: false, follow: true },
};

function resolveBackHref(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v === "string" && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/my";
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ back?: string | string[] }>;
}) {
  const sp = await searchParams;
  const backHref = resolveBackHref(sp.back);

  return (
    <>
      <MyTabBackdrop />
      <LibraryListScreenClient backHref={backHref} />
    </>
  );
}
