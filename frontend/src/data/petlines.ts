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
  { en: "Searching the archive is my job." },
  { jp: "ナニ オ サガス？", en: "What shall we find?" },
  { en: "Great Sage says: pick a pipeline." },
  { jp: "キミ ノ バン ダ", en: "Your move." },
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

/** Signature idle talk per pet form — each pet speaks in character. */
const FORM_LINES: Record<string, PetLine[]> = {
  original: [
    { jp: "スライム ダ ヨ", en: "I'm a slime." },
    { jp: "プルプル…", en: "*jiggle jiggle*" },
    { jp: "モト ノ カオ ダ", en: "Back to my old face." },
  ],
  rimuru: [
    { jp: "オレ ハ スライム ダ", en: "I am a slime." },
    { jp: "ホショク！", en: "Predator!" },
    { jp: "ナカマ ダ ヨ", en: "We're friends." },
  ],
  veldora: [
    { jp: "ドラゴン ノ イブキ ダ", en: "A dragon's breath." },
    { jp: "ソラ オ トブ ゾ", en: "I'll take to the sky." },
    { jp: "アラシヲ ヨベル", en: "I can summon storms." },
  ],
  benimaru: [
    { jp: "ハナ ノ ヨウ ニ サク", en: "Bloom like a flower." },
    { jp: "アカイ ハナ ダ", en: "A crimson blossom." },
  ],
  shion: [
    { jp: "シズカ ダ ケド ツヨイ", en: "Quiet, but strong." },
    { jp: "ムーンライト ノ シタ デ", en: "Under the moonlight." },
  ],
  ranga: [
    { jp: "ゴロゴロ…", en: "Purr…" },
    { jp: "ネコ モ ナカマ ダ", en: "Cats are friends too." },
    { jp: "フワフワ ダ", en: "So fluffy." },
  ],
  shuna: [
    { jp: "ツキ オ ミル ヨ", en: "Watching the moon." },
    { jp: "キツネ ノ ミチ ダ", en: "The fox's path." },
    { jp: "シッポ フリフリ", en: "*tail swish*" },
  ],
  gobta: [
    { jp: "ネムイ…", en: "So sleepy…" },
    { jp: "リンゴ クレ", en: "Give me an apple." },
    { jp: "オヤスミ…", en: "Good night…" },
  ],
  ciel: [
    { jp: "ケイサン カンリョウ", en: "Calculation complete." },
    { jp: "タダシイ ダ", en: "Correct." },
    { jp: "スイロン デキタ", en: "Inference done." },
  ],
  diablo: [
    { jp: "リョウイキ テンカイ", en: "Ryoiki Tenkai — Domain Expansion." },
    { jp: "ムゲン ノ ナカ ダ", en: "I'm limitless." },
    { jp: "サイキョウ ダ", en: "The strongest, of course." },
  ],
  milim: [
    { jp: "ステージ デ マテル", en: "Waiting on stage." },
    { jp: "アイドル ダ ヨ！", en: "I'm an idol!" },
    { jp: "ワンツー バランス", en: "1, 2, 3 — balance!" },
  ],
};

export function getPetLines(
  count: number,
  total: number,
  complete: boolean,
  variant = "rimuru",
): PetLine[] {
  const formLines = FORM_LINES[variant] ?? [];

  if (complete) return [...formLines, ...COMPLETE_LINES];

  const remaining = total - count;

  return [
    ...formLines,
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
  { jp: "コウシ デ オシエロ", en: "Feed me, I'll teach you." },
  { jp: "ナニカ タベル モノ ハ ナイ カ", en: "Anything edible around?" },
];

let _hungryIndex = 0;

export function getHungryLine(): PetLine {
  const line = HUNGRY_LINES[_hungryIndex % HUNGRY_LINES.length];
  _hungryIndex += 1;
  return line;
}

/** The pet's line for each paper-destruction mode (rotates). */
const DESTRUCTION_LINES: Record<string, PetLine[]> = {
  zap: [
    { jp: "クロ ホノオ！", en: "Black Flame!" },
    { jp: "バチバチ！", en: "Zapped to pixels!" },
    { jp: "サンデン カンリョウ", en: "Discharge complete." },
    { jp: "テンカイ！", en: "Domain Expansion!" },
  ],
  eat: [
    { jp: "ホショク！", en: "Predator!" },
    { jp: "モグモグ…", en: "*munch munch*… gone!" },
    { jp: "オイシイ ダ", en: "Delicious." },
    { jp: "マルノミ ダ", en: "Swallowed whole." },
    { jp: "ガツガツ クエ", en: "Gobbled it down." },
  ],
  crumple: [
    { jp: "クシャクシャ", en: "Crumpled it up." },
    { jp: "ゴミ バコ エ", en: "Off to the bin." },
    { jp: "ツブレタ ダ", en: "It's crushed." },
    { jp: "アトカタ ナシ ダ", en: "No trace left." },
  ],
  burn: [
    { jp: "メラメラ…ハイ ダ", en: "*crackle*… ash." },
    { jp: "モエツキル ダ", en: "Burned to cinders." },
    { jp: "オンド ジョウショウ", en: "Temperature rising." },
    { jp: "ハイ ニ ナレ", en: "Become ash." },
  ],
  default: [{ en: "Gone!" }],
};

let _destructionIndex = 0;

/** The pet's line for each paper-destruction mode (rotates). */
export function getDestructionLine(mode: string): PetLine {
  const pool = DESTRUCTION_LINES[mode] ?? DESTRUCTION_LINES.default;
  const line = pool[_destructionIndex % pool.length];
  _destructionIndex += 1;
  return line;
}