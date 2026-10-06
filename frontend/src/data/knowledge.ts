/* ============================================================
   TREE OF KNOWLEDGE
   Growth, species, and trivia handout logic, kept pure and
   deterministic so the pet's tree can be tested without a
   browser.

   Growth points come from what the user has earned: each of the
   six treasures, each achievement on the medal rack, and every
   fourth discovered tip. Four stages — Seed, Sprout, Sapling,
   Elder Tree — gate the trivia tiers: a taller tree may be asked
   deeper questions.

   The user also picks the species — Oak, Birch, Elm, or Redwood —
   which is purely cosmetic; growth and trivia are species-blind.

   LORE hands out the next unseen trivia at the current stage;
   once the stage's set has been fully learned it cycles through
   it in order, so repeated presses never repeat the same line
   twice in a row and nothing is ever generated.
   ============================================================ */

import { triviaAtStage, type Trivia } from "./trivia";

export const KNOWLEDGE_STAGES = [
  "Seed",
  "Sprout",
  "Sapling",
  "Elder Tree",
] as const;

/** Growth points needed to reach each later stage, in order. */
export const STAGE_THRESHOLDS = [3, 7, 12];

/** The next stage's threshold, or undefined when fully grown. */
export function nextStageThreshold(points: number): number | undefined {
  return STAGE_THRESHOLDS.find((threshold) => points < threshold);
}

/* ---------- species ---------- */

export type TreeSpeciesId =
  | "crimson"
  | "oak"
  | "birch"
  | "elm"
  | "redwood";

export interface TreeSpecies {
  id: TreeSpeciesId;
  label: string;
  /** Trunk colour (inline fill). */
  trunk: string;
  /** Foliage ramp: highlight, mid, shade (pixel-art three-tone). */
  leafLight: string;
  leaf: string;
  leafDeep: string;
}

export const TREE_SPECIES: TreeSpecies[] = [
  {
    /* The Crimson Tree from the reference: the default starter tree,
       its sprites and palette verbatim. */
    id: "crimson",
    label: "Maple",
    trunk: "#5a4e66",
    leafLight: "#ff3345",
    leaf: "#e5111f",
    leafDeep: "#b30f20",
  },
  {
    id: "oak",
    label: "Oak",
    trunk: "#8b5a2b",
    leafLight: "#8ce99a",
    leaf: "#40c057",
    leafDeep: "#2b8a3e",
  },
  {
    id: "birch",
    label: "Birch",
    trunk: "#f3f5f7",
    leafLight: "#cdeb5f",
    leaf: "#8fbf2e",
    leafDeep: "#4c7a16",
  },
  {
    id: "elm",
    label: "Elm",
    trunk: "#6f6456",
    leafLight: "#a8e6b5",
    leaf: "#3dbb61",
    leafDeep: "#1f7a3d",
  },
  {
    id: "redwood",
    label: "Redwood",
    trunk: "#9c4a2f",
    leafLight: "#48c96e",
    leaf: "#2f9e44",
    leafDeep: "#155e2b",
  },
];

export const DEFAULT_SPECIES: TreeSpeciesId = "oak";

export function treeSpecies(id: string | null | undefined): TreeSpecies {
  return (
    TREE_SPECIES.find((species) => species.id === id) ?? TREE_SPECIES[0]
  );
}

/* ---------- growth ---------- */

export interface KnowledgeInputs {
  /** Treasures collected in the scavenger hunt. */
  treasures: number;
  /** Achievements unlocked on the medal rack. */
  achievements: number;
  /** Tips discovered so far. */
  tips: number;
}

export interface TriviaHandout {
  trivia: Trivia;
  /** How many of the stage's trivias have been learned. */
  learned: number;
  /** How many trivias the current stage can give. */
  eligible: number;
  stage: number;
}

/** Growth points: hints + goals + a bonus per four discovered tips. */
export function knowledgePoints(inputs: KnowledgeInputs): number {
  return (
    inputs.treasures +
    inputs.achievements +
    Math.floor(inputs.tips / 4)
  );
}

/** Stage index: 0 Seed, 1 Sprout, 2 Sapling, 3 Elder Tree. */
export function knowledgeStage(points: number): number {
  if (points >= 12) return 3;
  if (points >= 7) return 2;
  if (points >= 3) return 1;
  return 0;
}

/**
 * The next trivia for a LORE press: the highest-tier unseen one at
 * this stage (deeper knowledge first), or a deterministic rotation
 * once everything at the stage has been learned. `seenIds` is the
 * press history in order and may contain repeats; learned counts
 * are computed over unique ids. Returns null only when the trivia
 * bank is empty.
 */
export function nextTrivia(
  stage: number,
  seenIds: readonly string[],
): TriviaHandout | null {
  const eligible = [...triviaAtStage(stage)].sort(
    (a, b) => b.tier - a.tier,
  );

  if (eligible.length === 0) return null;

  const seen = new Set(seenIds);
  const learned = eligible.filter((trivia) => seen.has(trivia.id)).length;
  const unseen = eligible.filter((trivia) => !seen.has(trivia.id));

  if (unseen.length > 0) {
    return {
      trivia: unseen[0],
      learned,
      eligible: eligible.length,
      stage,
    };
  }

  /* Everything learned: continue from the last press in history so
     presses keep cycling without immediate repeats. */
  const lastId = seenIds.length > 0
    ? seenIds[seenIds.length - 1]
    : null;
  const lastIndex = lastId
    ? eligible.findIndex((trivia) => trivia.id === lastId)
    : -1;

  return {
    trivia: eligible[(lastIndex + 1) % eligible.length],
    learned,
    eligible: eligible.length,
    stage,
  };
}

/* ---------- skins and growth economy ---------- */

/** Growth token prices for tree skins; crimson is the free
 *  default (the reference's tree). */
export const TREE_SKIN_PRICES: Record<TreeSpeciesId, number> = {
  oak: 0,
  crimson: 25,
  birch: 25,
  elm: 40,
  redwood: 60,
};

/** Total fertilizer packets that grow the tree to the ancient
 *  tree — ten thousand feedings on the reference's timeline. */
export const TREE_GROWTH_TARGET = 10000;

/** Growth markers: the maple reference's stage captions, mapped
 *  to fertilizer counts (g<0.04 Seed … P>=0.66 Ancient maple). */
/* Equally divided: seven stages across the 10,000 feedings,
 * 10,000 / 6 apart. */
export const TREE_GROWTH_MARKERS = [
  { label: "Seed", fert: 0 },
  { label: "Seedling", fert: 1667 },
  { label: "Sapling", fert: 3333 },
  { label: "Young maple", fert: 5000 },
  { label: "Mature maple", fert: 6667 },
  { label: "Giant", fert: 8333 },
  { label: "Ancient maple", fert: TREE_GROWTH_TARGET },
] as const;

/** Height (ft) at which each later knowledge stage unlocks. */
export const STAGE_HEIGHTS = [100, 300, 1000];

/**
 * Knowledge stage from the tree's height: the tree only knows as
 * deep as it has physically grown — discoveries and feedings raise
 * it, and with it what it can be asked.
 */
export function knowledgeStageFromHeight(height: number): number {
  if (height >= 1000) return 3;
  if (height >= 300) return 2;
  if (height >= 100) return 1;
  return 0;
}

/** The next height that unlocks deeper knowledge, or undefined when
 *  the tree knows everything it can hold. */
export function nextKnowledgeHeight(
  height: number,
): number | undefined {
  return STAGE_HEIGHTS.find((threshold) => height < threshold);
}

/* ---------- tree idle speech (pet-style ambient lines) ---------- */

export const TREE_IDLE_LINES: { text: string; topic: string }[] = [
  { text: "Every ring remembers a feed.", topic: "Grove lore" },
  { text: "Roots first. The rest follows.", topic: "Grove lore" },
  { text: "I forget nothing I have learned.", topic: "Grove lore" },
  { text: "A sun at a time, the world tree rises.", topic: "Grove lore" },
  { text: "Ask me when I have grown taller.", topic: "Grove lore" },
  { text: "The leaves tell the season. The rings tell the years.", topic: "Grove lore" },
  { text: "Feed me what you find. I will keep it.", topic: "Grove lore" },
  { text: "Even a seed knows its direction.", topic: "Grove lore" },
  { text: "The deeper the root, the higher the crown.", topic: "Grove lore" },
  { text: "A quiet tree still counts the sun.", topic: "Grove lore" },
];
