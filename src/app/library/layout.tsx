import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "점사 보관함 | 연운 緣運",
  description: "저장한 점사 풀이를 다시 열람합니다.",
  robots: { index: false, follow: true },
};

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
