/** AuthModal TIME_TABS 순서(子→亥)와 동일 */
export const TIME_TAB_BRANCH_KEYS = [
  "zi",
  "chou",
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai",
] as const;

export type BirthBranchKey = (typeof TIME_TAB_BRANCH_KEYS)[number];
