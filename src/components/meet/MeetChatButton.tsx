"use client";

import Link from "next/link";

type Props = {
  characterKey: string;
  className?: string;
  children: React.ReactNode;
};

/** 비회원도 로컬 체험 크레딧으로 채팅 상담 진입 가능 */
export function MeetChatButton({ characterKey, className, children }: Props) {
  const href = `/meet?modal=chat_consult&character_key=${encodeURIComponent(characterKey)}`;

  return (
    <Link href={href} scroll={false} className={className}>
      {children}
    </Link>
  );
}
