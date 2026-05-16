/** 대메뉴(PART)에 속한 모든 소메뉴 섹션이 section_end(done) 됐는지 */
export function fortunePartSectionsReady(
  sectionIndices: number[],
  doneIdx: ReadonlySet<number>,
  complete: boolean,
): boolean {
  if (complete) return true;
  if (!sectionIndices.length) return false;
  return sectionIndices.every((i) => doneIdx.has(i));
}

/** PART `target`으로 이동 가능: 이미 방문한 PART이거나, 앞 PART가 모두 완료됨 */
export function canNavigateToFortunePart(
  target: number,
  currentPage: number,
  groups: { sectionIndices: number[] }[],
  doneIdx: ReadonlySet<number>,
  complete: boolean,
): boolean {
  if (complete) return true;
  if (target <= currentPage) return true;
  for (let p = 0; p < target; p++) {
    const g = groups[p];
    if (!g) return false;
    if (!fortunePartSectionsReady(g.sectionIndices, doneIdx, false)) return false;
  }
  return true;
}
