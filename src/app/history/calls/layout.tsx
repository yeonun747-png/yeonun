import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "음성상담 보관함 | 연운 緣運",
  description: "종료된 음성 상담 목록과 대화 글(전사)을 60일간 확인합니다.",
};

export default function CallHistoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
