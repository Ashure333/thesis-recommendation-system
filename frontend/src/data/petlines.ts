/* ============================================================
   PET LINES — short conversational lines the pixel pet floats
   above itself. The pet has a second voice: occasionally it
   speaks a line in Japanese characters and immediately
   translates it, the way a game companion would.

   CHARACTER — the pet is a self-aware slime in the spirit of
   Rimuru Tempest (転生したらスライムだった件): playful and
   gluttonous, as a slime it brings out its ultimate skills
   (Beelzebub, Gluttony, Imaginary Space) to gobble library
   papers, and names everything it likes. Friends (ナカマ) are
   its whole deal.

   The lines stay neutral on purpose: each of the eleven forms gets
   its own in-character signature talk (FORM_LINES), so the shared
   pools below never name a particular form's character — otherwise
   every pet would claim to be Rimuru, or talk about Veldora while
   wearing Glaucira's sprite.

   DISPOSAL is per character too: when a crumpled paper is thrown
   at the pet, only the slime forms (Original, Rimuru) actually
   eat it. Every other form answers with a power from its role —
   Gojo casts Cursed Techniques, Glaucira breathes Storm Breath,
   Mashiro Rima punches it flat — with its own hover and reaction
   lines (FORM_DROP_MODES / FORM_HUNGRY_LINES / FORM_DROP_LINES).
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
  { jp: "ココ ダヨ", en: "I am right here." },
  { jp: "タノシイネ", en: "This is fun." },
  { en: "Click me to chat." },
  { jp: "ガンバレ！", en: "You got this!" },
  { jp: "ナカマ ダ ヨ", en: "We're friends." },
  { jp: "ナマエ オ ツケテ アゲル", en: "Let me name you." },
  { jp: "イツカ オオキク ナル ゾ", en: "Someday I will be great." },
  { en: "Searching the archive is my job." },
  { jp: "ナニ オ サガス？", en: "What shall we find?" },
  { en: "Pick a pipeline and I will read it." },
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
  { en: "I am a full help library now." },
  { jp: "キイテ ミテ！", en: "Ask me anything!" },
  { en: "Your move, partner." },
  { jp: "ゼンブ ナカマ ダ", en: "Everyone's a friend now." },
  { en: "Every form unlocked. Take your pick." },
];

/** Signature idle talk per pet form — each pet speaks in character, and
 *  matches the form's actual name/identity in petForms.ts. */
const FORM_LINES: Record<string, PetLine[]> = {
  original: [
    { jp: "スライム ダ ヨ", en: "I am a slime." },
    { jp: "プルプル…", en: "*jiggle jiggle*" },
    { jp: "モト ノ カオ ダ", en: "Back to my old face." },
  ],
  rimuru: [
    { jp: "オレ ハ スライム ダ", en: "I am a slime." },
    { jp: "ベルゼブブ！", en: "Beelzebub!" },
    { jp: "クウソウ クウカン！", en: "Imaginary Space!" },
    { jp: "ナカマ ダ ヨ", en: "We're friends." },
  ],
  veldora: [
    { jp: "ドラゴン ノ イブキ ダ", en: "A dragon's breath." },
    { jp: "ソラ オ トブ ゾ", en: "I will take to the sky." },
    { jp: "オーロラ ノ ヒカル", en: "Aurora light." },
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
    { jp: "ニョウ ニャ", en: "Meow." },
    { jp: "ネコ ダ ケド ナカマ ダ", en: "A cat, but still a friend." },
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
    { jp: "ムゲン ノ ナカ ダ", en: "I am limitless." },
    { jp: "サイキョウ ダ", en: "The strongest, of course." },
  ],
  milim: [
    { jp: "ステージ デ マテル", en: "Waiting on stage." },
    { jp: "アイドル ダ ヨ！", en: "I am an idol!" },
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
  { jp: "ハラペコ ダ", en: "I am starving." },
  { jp: "タベタイ！", en: "Feed me!" },
  { jp: "オレ オ ナメルナヨ", en: "Don't underestimate me." },
  { jp: "ウマイ ウマイ", en: "Yummy, yummy." },
  { jp: "コウシ デ オシエロ", en: "Feed me, I will teach you." },
  { jp: "ナニカ タベル モノ ハ ナイ カ", en: "Anything edible around?" },
];

/** Hover lines for the forms that do NOT want to eat the paper —
 *  each waits for the throw with its own power. The slime forms
 *  fall back to the shared HUNGRY_LINES above. */
const FORM_HUNGRY_LINES: Record<string, PetLine[]> = {
  veldora: [
    { jp: "オレ ニ カケル ナ", en: "Come — taste my storm." },
    { jp: "クダケナ", en: "I will blow it away." },
    { jp: "チョウセン ダ", en: "Challenge accepted." },
  ],
  benimaru: [
    { jp: "ホノオ ガ ヒカル", en: "My flames are hungry." },
    { jp: "キョウカ ナ", en: "Careful — fire answers." },
    { jp: "イッテン デ ハイ", en: "One spark and it is ash." },
  ],
  shion: [
    { jp: "ウゴク ナ", en: "Hold still." },
    { jp: "イチッキリ", en: "One clean cut." },
    { jp: "キレイ ニ クレル ヨ", en: "I will tidy this up." },
  ],
  ranga: [
    { jp: "ガルルル…", en: "*growl*…" },
    { jp: "イナヅマ マタウ", en: "Lightning's itching." },
    { jp: "ワン！", en: "Woof!" },
  ],
  shuna: [
    { jp: "シズカ ニ ナレ", en: "Rest quietly." },
    { jp: "オリガミ ニ ナル ヨ", en: "You'll make fine origami." },
    { jp: "トジコメ テ アゲル", en: "I will seal you away." },
  ],
  gobta: [
    { jp: "ネムテル タビニ", en: "Toss it while I nap." },
    { jp: "ダレ…？", en: "Huh…? Who's there?" },
    { jp: "ヤキグチ ジャナイ…", en: "Not a snack…" },
  ],
  ciel: [
    { jp: "ターゲット キロク", en: "Target locked." },
    { jp: "ユソク カンリョウ", en: "Trajectory calculated." },
    { jp: "イドウ ヨソク カイシ", en: "Movement predicted." },
  ],
  diablo: [
    { jp: "ヤッテ ミロ", en: "Go on — throw it." },
    { jp: "ジカン ヲ モダウ ナ", en: "Don't waste my time." },
    { jp: "リョウイキ ノ ジュンビ オワッタ", en: "Domain's ready." },
  ],
  milim: [
    { jp: "パパンチ ナ ラ", en: "Wanna see my punch?" },
    { jp: "ミナセ ヨ", en: "I dare you." },
    { jp: "ワンツー サン！", en: "1, 2, 3!" },
  ],
};

let _hungryIndex = 0;

export function getHungryLine(variant = "rimuru"): PetLine {
  const pool = FORM_HUNGRY_LINES[variant] ?? HUNGRY_LINES;
  const line = pool[_hungryIndex % pool.length];
  _hungryIndex += 1;
  return line;
}

/** The four ways the pet disposes of a paper (also the body
 *  reaction animations). Only the slime forms ever pick "eat"
 *  when a paper is thrown at them — see FORM_DROP_MODES. */
export type DropMode = "zap" | "eat" | "crumple" | "burn";

/** The pet's line for each paper-destruction mode (rotates). */
const DESTRUCTION_LINES: Record<string, PetLine[]> = {
  zap: [
    { jp: "クロ ホノオ！", en: "Black Flame!" },
    { jp: "バチバチ！", en: "Zapped to pixels!" },
    { jp: "サンデン カンリョウ", en: "Discharge complete." },
    { jp: "テンカイ！", en: "Domain Expansion!" },
  ],
  eat: [
    { jp: "ボウショク！", en: "Gluttony!" },
    { jp: "ベルゼブブ！", en: "Beelzebub!" },
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

/** The mode each form uses when a crumpled paper is thrown at it.
 *  Only the slime forms (Original, Rimuru) eat — everyone else
 *  answers with a power from their role. */
const FORM_DROP_MODES: Record<string, DropMode[]> = {
  original: ["eat"],
  rimuru: ["eat"],
  veldora: ["burn"],
  benimaru: ["burn"],
  shion: ["crumple"],
  ranga: ["zap"],
  shuna: ["crumple"],
  gobta: ["crumple"],
  ciel: ["zap"],
  diablo: ["zap"],
  milim: ["crumple"],
};

/** In-character reaction lines for the mode the form actually
 *  uses. The slime forms fall back to the shared DESTRUCTION_LINES
 *  eat pool (Gluttony, Beelzebub, munch munch…). */
const FORM_DROP_LINES: Record<string, Partial<Record<DropMode, PetLine[]>>> = {
  veldora: {
    burn: [
      { jp: "ストーム ブレス！", en: "Storm Breath!" },
      { jp: "オーロラ ノ ヒカリデ サク", en: "Aurora light — incinerated." },
      { jp: "カゼト ヒノカゲキ", en: "Wind and flame unleashed." },
    ],
  },
  benimaru: {
    burn: [
      { jp: "クロ ホノオ！", en: "Black Flame!" },
      { jp: "ホムラ！", en: "Homura — death flame!" },
      { jp: "センエン ノ ヒ", en: "Crimson incineration." },
    ],
  },
  shion: {
    crumple: [
      { jp: "アックス オフル！", en: "Axe swing!" },
      { jp: "ツブレタ ダ", en: "Crushed in one strike." },
      { jp: "オサメ カンリョウ", en: "Cleanup complete." },
    ],
  },
  ranga: {
    zap: [
      { jp: "ライデン！", en: "Thunderbolt!" },
      { jp: "ヤミカミ ノリ", en: "Dark lightning strikes!" },
      { jp: "ワンッ！", en: "Woof — gone!" },
    ],
  },
  shuna: {
    crumple: [
      { jp: "オリガミ ニ シテ アゲル", en: "Folded into origami." },
      { jp: "フシグ ナヨウ ニ", en: "Folded away neatly." },
      { jp: "イノリ デ トジコメ", en: "Sealed with a prayer." },
    ],
  },
  gobta: {
    crumple: [
      { jp: "ネムイ ウチ ニ ナッタ", en: "Flattened in my sleep." },
      { jp: "ダレカ ヤッタ…？", en: "Did I do that?" },
      { jp: "イネムリ ヲ マワシタ", en: "Blame the nap." },
    ],
  },
  ciel: {
    zap: [
      { jp: "キョウフン カンリョウ", en: "Annihilation complete." },
      { jp: "サガテ タダシイ", en: "Verified correct." },
      { jp: "ウリョ カンリョウ", en: "Analysis done — erased." },
    ],
  },
  diablo: {
    zap: [
      { jp: "アオ！", en: "Cursed Technique: Blue!" },
      { jp: "アカ！", en: "Cursed Technique: Red!" },
      { jp: "虚式 ムラサキ", en: "Hollow Purple!" },
      { jp: "ジュツシキ カイホウ！", en: "Cursed Techniques!" },
    ],
  },
  milim: {
    crumple: [
      { jp: "ワン ツー パンチ！", en: "1, 2 — punch!" },
      { jp: "コナゴナ ニ ナッタ", en: "Punched into a paper ball!" },
      { jp: "オオキク ナ ヨウ ニ", en: "Knocked flat!" },
    ],
  },
};

/** The mode this form uses on a thrown crumpled paper. Unknown
 *  forms fall back to the full random pool. */
export function getDropMode(variant: string): DropMode {
  const modes = FORM_DROP_MODES[variant];
  if (!modes || modes.length === 0) {
    const all: DropMode[] = ["zap", "eat", "crumple", "burn"];
    return all[Math.floor(Math.random() * all.length)];
  }
  return modes[Math.floor(Math.random() * modes.length)];
}

let _destructionIndex = 0;

/** The pet's line for a paper-destruction reaction: the form's own
 *  power lines when it has them, the shared pool otherwise. */
export function getDestructionLine(mode: string, variant?: string): PetLine {
  const formPool = variant
    ? FORM_DROP_LINES[variant]?.[mode as DropMode]
    : undefined;
  const pool = formPool ?? DESTRUCTION_LINES[mode] ?? DESTRUCTION_LINES.default;
  const line = pool[_destructionIndex % pool.length];
  _destructionIndex += 1;
  return line;
}