/** 한글 음절 마지막 글자 받침 여부 */
function koreanSyllableHasBatchim(char: string): boolean {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/** 이름 + 주격 조사 (여연→여연이, 별하→별하가) */
export function nameWithSubjectParticle(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const last = trimmed[trimmed.length - 1]!;
  const particle = koreanSyllableHasBatchim(last) ? "이" : "가";
  return `${trimmed}${particle}`;
}
