/* ============================================================
   PET LINES — short conversational lines the pixel pet floats
   above itself. The pet has a second voice: occasionally it
   speaks a line in Japanese characters and immediately
   translates it, the way a game companion would.

   CHARACTER — the pet is a self-aware slime in the spirit of
   Rimuru Tempest (転生したらスライムだった件): playful and
   gluttonous, it "predates" on library papers, leans on its
   inner Great Sage to analyze recommendations, and names
   everything it likes. Friends (ナカマ) are its whole deal —
   including the storm dragon chattering from inside it.
   ============================================================ */

export interface PetLine {
  /** Japanese line (the pet's "other voice"); always shown with its translation. */
  jp?: string;
  /** The line's translation / plain line. */
  en: string;
}

const IDLE_LINES: PetLine[] = [
  { jp: "コンニチハ！", en: "Hello!" },
  { en: "Hover me for tips." },
  { jp: "ココ ダヨ", en: "I'm right here." },
  { en: "6 modes enter. 1 leaves." },
  { jp: "タノシイネ", en: "This is fun." },
  { en: "Click me to chat." },
  { jp: "ガンバレ！", en: "You got this!" },
  { jp: "オレ ハ スライム ダ", en: "I am a slime." },
  { jp: "テンセイ シタ ラ スライム ダッタ", en: "Reincarnated… as a slime." },
  { jp: "ダイケンジャ ガ ブンセキチュウ", en: "Great Sage is analyzing…" },
  { jp: "ナカマ ダ ヨ", en: "We're friends." },
  { jp: "ナマエ オ ツケテ アゲル", en: "Let me name you." },
  { jp: "ベンドラ ガ ヨロコンデル", en: "Veldora is pleased." },
  { jp: "イツカ オオキク ナル ゾ", en: "Someday I'll be great." },
];

const HUNT_LINES: PetLine[] = [
  { jp: "タカラ オ サガソウ", en: "Let's hunt for treasure!" },
  { en: "Six treasures hide on the pages." },
  { jp: "ミツケテ クレ", en: "Go find them for me." },
  { en: "Click me for a hint." },
  { jp: "ボウケン ダ！", en: "An adventure!" },
  { jp: "オレ ニ マカセロ", en: "Leave it to me." },
  { jp: "タカラ ハ ナカマ ノ タメ ニ", en: "Treasure is for friends." },
];

const COMPLETE_LINES: PetLine[] = [
  { jp: "ゼンブ ミツケタ！", en: "You found them all!" },
  { en: "I'm a full help library now." },
  { jp: "キイテ ミテ！", en: "Ask me anything!" },
  { en: "Your move, partner." },
  { jp: "ゼンブ ナカマ ダ", en: "Everyone's a friend now." },
  { jp: "ココ ガ テンペスト ダ", en: "This is Tempest now." },
];

export function getPetLines(
  count: number,
  total: number,
  complete: boolean,
): PetLine[] {
  if (complete) return COMPLETE_LINES;

  const remaining = total - count;

  return [
    ...IDLE_LINES,
    ...HUNT_LINES,
    {
      jp: `アト ${remaining} コ`,
      en: `${remaining} treasure${remaining === 1 ? "" : "s"} left.`,
    },
  ];
}

/** Shown while a library paper is being dragged over the pet. */
const HUNGRY_LINES: PetLine[] = [
  { jp: "クレ クレ！", en: "Gimme!" },
  { jp: "ハラペコ ダ", en: "I'm starving." },
  { jp: "ホショク タイ", en: "Predator!" },
  { jp: "オレ オ ナメルナヨ", en: "Don't underestimate me." },
  { jp: "ウマイ ウマイ", en: "Yummy, yummy." },
];

let _hungryIndex = 0;

export function getHungryLine(): PetLine {
  const line = HUNGRY_LINES[_hungryIndex % HUNGRY_LINES.length];
  _hungryIndex += 1;
  return line;
}

/** The pet's line for each paper-destruction mode. */
export function getDestructionLine(mode: string): PetLine {
  switch (mode) {
    case "zap":
      return { jp: "クロ ホノオ！", en: "Black Flame!" };
    case "eat":
      return { jp: "ホショク！", en: "Predator!" };
    case "crumple":
      return { jp: "マルノミ ダ", en: "Swallowed whole." };
    case "burn":
      return { jp: "メラメラ…ハイ ダ", en: "*crackle*… ash." };
    default:
      return { en: "Gone!" };
  }
}