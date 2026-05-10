/** DB·상품 `character_key`(짧은 키)와 스토리 블록 키 정렬 — 짧은 키만 오면 연화(yeonhwa)로 잘못 폴백되던 문제 방지 */
export type FortuneEpisodeStoryBucket = "yeonhwa" | "byeolha" | "yeoyeon" | "unseo";

export function fortuneEpisodeStoryBucket(characterKey: string): FortuneEpisodeStoryBucket {
  const k = characterKey.trim().toLowerCase();
  if (k === "yeon" || k === "yeonhwa") return "yeonhwa";
  if (k === "byeol" || k === "byeolha") return "byeolha";
  if (k === "yeo" || k === "yeoyeon") return "yeoyeon";
  if (k === "un" || k === "unseo") return "unseo";
  return "yeonhwa";
}

/** 스텝2 등 3화 에피소드 본문 — `character.key` 또는 `product.character_key`에 사용 */
export function fortuneEpisodeTalks(characterKey: string): string[] {
  const bucket = fortuneEpisodeStoryBucket(characterKey);
  return CHARACTER_STORIES[bucket] ?? CHARACTER_STORIES.yeonhwa;
}

export const CHARACTER_STORIES: Record<string, string[]> = {
  // ── 연화 (緣花) ── 인연 · 연애 · 재회 · 궁합
  yeonhwa: [
    "연화선생님은 두 사람 사이의 보이지 않는 감정 흐름을 읽는 분이에요. 말 한마디 없이도 그 인연이 어디로 흘러가는지 바로 아신다니까요 🌸",
    "3년 동안 연락이 끊겼던 두 분이 연화선생님 풀이를 받고 그해에 재회했다는 이야기를 들었어요. 그런 일이 한두 번이 아니에요. 그래서 저도 연화선생님을 제일 좋아해요!",
    "연화선생님이 지금 두 분 사이의 인연줄을 살펴보고 계세요. 집중하실 때 특유의 표정이 있거든요. 뭔가 중요한 걸 발견하신 것 같아요 🌸",
  ],

  // ── 별하 (別夏) ── 신년운세 · 자미두수 · 시기운 · 토정비결
  byeolha: [
    "별하선생님은 별의 흐름으로 한 해의 운기를 읽어내세요. 특히 어떤 시기에 무엇을 해야 하는지, 언제 움직이고 언제 기다려야 하는지를 딱 짚어주시거든요!",
    "발랄해 보여도 사실 엄청 깊이 있는 분이에요. 별하선생님이 맞추신 시기가 너무 정확해서 처음에 저도 깜짝 놀랐어요. 한 번 보신 분들이 꼭 연초마다 다시 찾아오시더라고요 🌸",
    "별하선생님이 올해 운기를 살펴보시고 눈이 반짝이셨어요. 어떤 흐름이 보이실 때 그 표정이 나오거든요. 어서 풀이를 확인해보세요!",
  ],

  // ── 여연 (如緣) ── 정통사주 · 커리어 · 재물 · 평생운
  yeoyeon: [
    "여연선생님은 명리학을 오랫동안 깊이 공부하신 분이에요. 사주 하나를 보실 때 정말 구석구석 다 보시거든요. 어떤 작은 글자도 그냥 지나치지 않으세요 🌸",
    "여연선생님 풀이는 길어요. 그만큼 꼼꼼하게 보시기 때문이에요. 받아 보신 분들이 '이게 다 어떻게 맞아?' 하면서 소름 돋는다고 하시더라고요. 저도 옆에서 들으면서 배우는 게 많아요",
    "여연선생님이 지금 명식을 보시면서 한참 생각에 잠기셨어요. 깊이 있는 사주일수록 더 오래 들여다보시거든요. 그만큼 중요한 걸 보고 계신다는 뜻이에요 🌸",
  ],

  // ── 운서 (運書) ── 작명 · 택일 · 꿈해몽 · 자미두수 명반
  unseo: [
    "운서선생님은 이름 하나, 날짜 하나에도 엄청난 기운이 담겨 있다고 하세요. 글자와 숫자 속에서 운의 흐름을 읽어내시는 아주 섬세한 분이에요 🌸",
    "운서선생님께 작명 받은 아이가 정말 그 이름대로 자라더라는 이야기를 들었어요. 이름이 이렇게 중요한 거구나 싶었어요. 운서선생님은 절대 대충 보시는 법이 없어요",
    "운서선생님이 지금 아주 신중하게 들여다보고 계세요. 섬세한 분이셔서 모든 글자 하나하나를 다 확인하시거든요. 거의 다 됐어요 🌸",
  ],
};

// DB character_key: yeon·byeol·yeo·un ↔ 스토리 블록: yeonhwa·byeolha·yeoyeon·unseo (`fortuneEpisodeStoryBucket`)
