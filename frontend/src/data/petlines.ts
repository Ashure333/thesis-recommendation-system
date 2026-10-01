/* ============================================================
   PET LINES — short conversational lines the pixel pet floats
   above itself. The pet has a second voice: occasionally it
   speaks a line in Japanese characters and immediately
   translates it, the way a game companion would.
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
];

const HUNT_LINES: PetLine[] = [
  { jp: "タカラ オ サガソウ", en: "Let's hunt for treasure!" },
  { en: "Six treasures hide on the pages." },
  { jp: "ミツケテ クレ", en: "Go find them for me." },
  { en: "Click me for a hint." },
];

const COMPLETE_LINES: PetLine[] = [
  { jp: "ゼンブ ミツケタ！", en: "You found them all!" },
  { en: "I'm a full help library now." },
  { jp: "キイテ ミテ！", en: "Ask me anything!" },
  { en: "Your move, partner." },
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
export const HUNGRY_LINE: PetLine = {
  jp: "クレ クレ！",
  en: "Gimme!",
};

/** The pet's line for each paper-destruction mode. */
export function getDestructionLine(mode: string): PetLine {
  switch (mode) {
    case "zap":
      return { jp: "バチバチ！", en: "Zapped to pixels!" };
    case "eat":
      return { jp: "モグモグ…", en: "*munch munch*… gone!" };
    case "crumple":
      return { jp: "クシャクシャ", en: "Crumpled it up." };
    case "burn":
      return { jp: "メラメラ", en: "Burned to ash." };
    default:
      return { en: "Gone!" };
  }
}