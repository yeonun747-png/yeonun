import Link from "next/link";

type Props = {
  characterKey: string;
  className?: string;
  children: React.ReactNode;
};

export function MeetChatButton({ characterKey, className, children }: Props) {
  return (
    <Link
      href={`/meet?modal=chat_consult&character_key=${encodeURIComponent(characterKey)}`}
      scroll={false}
      className={className}
    >
      {children}
    </Link>
  );
}
