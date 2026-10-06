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

export const DEFAULT_SPECIES: TreeSpeciesId = "crimson";

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
  crimson: 0,
  oak: 25,
  birch: 25,
  elm: 40,
  redwood: 60,
};

/** Total fertilizer packets that grow the tree to the ancient
 *  tree — three thousand feedings on the reference's timeline. */
export const TREE_GROWTH_TARGET = 3000;

/** Feet at each growth stage: the height is relative to the tree's
 *  stage, scaled to the mural's milestones (cheats at 100 / 500 /
 *  1000 ft, knowledge at 100 / 300 / 1000 ft). */
/* The seven stage positions (fertilizer), per species. */
export const SPECIES_STAGE_FERT: Record<TreeSpeciesId, number[]> = {
  crimson: [0, 400, 900, 1450, 2000, 2580, TREE_GROWTH_TARGET],
  oak: [0, 450, 950, 1500, 2050, 2550, TREE_GROWTH_TARGET],
  birch: [0, 480, 1000, 1580, 2100, 2600, TREE_GROWTH_TARGET],
  elm: [0, 500, 1050, 1600, 2150, 2650, TREE_GROWTH_TARGET],
  redwood: [0, 380, 850, 1350, 1900, 2450, TREE_GROWTH_TARGET],
};

/* The ACTUAL painted height of each stage's tree — the drawn
   extent (canopy top to root) as a fraction of the ancient tree,
   in feet (ancient = 1000 ft, the top of the climb). Measured
   from the rendered pixels of each species' own silhouette, so
   the ft labels follow the true relative height of the art. */
export const SPECIES_STAGE_FT: Record<TreeSpeciesId, number[]> = {
  crimson: [39, 236, 756, 953, 961, 1000, 1000],
  oak: [31, 268, 780, 953, 1000, 1000, 1000],
  birch: [31, 276, 693, 953, 1000, 1000, 1000],
  elm: [31, 291, 669, 953, 1000, 1000, 1000],
  redwood: [24, 228, 661, 961, 953, 1000, 1000],
};

/** Height in feet for a species at its fertilizer position — a
 *  smooth climb through the ACTUAL stage heights, so the labels
 *  track the tree's true relative size as the canopy rises. */
export function treeHeightByFertilizer(
  fert: number,
  species: TreeSpeciesId = DEFAULT_SPECIES,
): number {
  const ferts = SPECIES_STAGE_FERT[species];
  const fts = SPECIES_STAGE_FT[species];
  const t = Math.min(1, Math.max(0, fert / TREE_GROWTH_TARGET));
  const pos = t * (ferts.length - 1);
  const i = Math.min(ferts.length - 2, Math.max(0, Math.floor(pos)));
  const f = Math.min(1, pos - i);
  const ease = f * f * (3 - 2 * f);
  return Math.round(fts[i] + (fts[i + 1] - fts[i]) * ease);
}

/** Growth markers: the maple reference's stage captions, mapped
 *  to fertilizer counts (g<0.04 Seed … P>=0.66 Ancient maple). */
/* Equally divided: seven stages across the 3,000 feedings,
 * 3,000 / 6 apart. */
/* Per-species dossier: the names, the facts, and the research a
   grown tree can report. Shown in the garden's default sidebar. */
export const SPECIES_INFO: Record<
  TreeSpeciesId,
  { name: string; fact: string; research: string }
> = {
  crimson: {
    name: "Crimson Maple",
    fact:
      "Acer rubrum — the red maple, named for the blaze its leaves " +
      "turn before they fall. Its samaras spin like helicopters.",
    research:
      "Fast-growing and wide-ranging: red maples span the whole " +
      "eastern hardwood region. Dense canopies shade the understory " +
      "they feed with their fluttering keys.",
  },
  oak: {
    name: "Royal Oak",
    fact:
      "Quercus robur — the common oak, the well-trodden landmark " +
      "of every forest edge, slow to grow and slow to go.",
    research:
      "Oaks hold their leaves into winter and drop acorns that " +
      "feed a hundred beasts. Deep taproots anchor centuries.",
  },
  birch: {
    name: "Silver Birch",
    fact:
      "Betula pendula — the birch of the silver bark, peeling in " +
      "fine layers like paper that takes ink without complaint.",
    research:
      "Pioneers of open ground: birch seed lands on bare soil and " +
      "rises fast, brightening the woods it marches into.",
  },
  elm: {
    name: "Water Elm",
    fact:
      "Ulmus americana — the elm of the cathedral arch, the vase " +
      "shape of its crown copied by every laid-out avenue.",
    research:
      "Historically grand, disease-thinned: the elm's arch survives " +
      "in park avenues where its root systems linger long.",
  },
  redwood: {
    name: "Giant Redwood",
    fact:
      "Sequoia sempervirens — the tallest living thing ever " +
      "measured, standing in fog belts along the Pacific coast.",
    research:
      "Boughs almost a kilometre up, ringed like time itself. Its " +
      "bark, thick and fibrous, shrugs off fire and beetle alike.",
  },
};

export const TREE_GROWTH_MARKERS = [
  { label: "Seed", fert: 0 },
  { label: "Seedling", fert: 500 },
  { label: "Sapling", fert: 1000 },
  { label: "Young maple", fert: 1500 },
  { label: "Mature maple", fert: 2000 },
  { label: "Giant", fert: 2500 },
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

/* ---------- per-species cheats and growth progress ---------- */

/** Cheat unlock heights, shared by every species. */
export const CHEAT_HEIGHTS = [100, 500, 1000];

/** Each tree offers its own three cheat words. */
export const CHEAT_SETS: Record<
  TreeSpeciesId,
  { word: string; effect: string }[]
> = {
  oak: [
    { word: "daisies", effect: "Papers the pet eats leave little daisies behind." },
    { word: "dance", effect: "The pet dances on the spot." },
    { word: "pinata", effect: "Every paper the pet eats bursts into candy." },
  ],
  crimson: [
    { word: "syrup", effect: "The pet drips maple syrup from its whiskers." },
    { word: "blaze", effect: "The pet blazes autumn-orange for a while." },
    { word: "amber", effect: "Every paper the pet eats bursts into amber confetti." },
  ],
  birch: [
    { word: "paper", effect: "The pet wraps papers in thin papery sheets." },
    { word: "silver", effect: "The pet's trail silvers like birch bark." },
    { word: "ribbon", effect: "The pet unfurls a pale birch ribbon." },
  ],
  elm: [
    { word: "vase", effect: "The pet sweeps a vase-crown shadow." },
    { word: "ridge", effect: "The pet's fur grows deep elm ridges." },
    { word: "shade", effect: "The pet rests in an elm's shade." },
  ],
  redwood: [
    { word: "grove", effect: "The pet hums from a redwood grove." },
    { word: "mist", effect: "The pet gives off coastal mist." },
    { word: "elder", effect: "The pet stands tall as an elder redwood." },
  ],
};

/** Each species matures on its own curve: the seven stage fert
 *  positions differ per tree while the march stays 3,000. */
export const SPECIES_GROWTH_MARKERS: Record<
  TreeSpeciesId,
  { label: string; fert: number }[]
> = {
  oak: [
    { label: "Seed", fert: 0 },
    { label: "Seedling", fert: 450 },
    { label: "Sapling", fert: 950 },
    { label: "Young oak", fert: 1500 },
    { label: "Mature oak", fert: 2050 },
    { label: "Giant", fert: 2550 },
    { label: "Ancient oak", fert: TREE_GROWTH_TARGET },
  ],
  crimson: [
    { label: "Seed", fert: 0 },
    { label: "Seedling", fert: 400 },
    { label: "Sapling", fert: 900 },
    { label: "Young maple", fert: 1450 },
    { label: "Mature maple", fert: 2000 },
    { label: "Giant", fert: 2580 },
    { label: "Ancient maple", fert: TREE_GROWTH_TARGET },
  ],
  birch: [
    { label: "Seed", fert: 0 },
    { label: "Seedling", fert: 480 },
    { label: "Sapling", fert: 1000 },
    { label: "Young birch", fert: 1580 },
    { label: "Mature birch", fert: 2100 },
    { label: "Giant", fert: 2600 },
    { label: "Ancient birch", fert: TREE_GROWTH_TARGET },
  ],
  elm: [
    { label: "Seed", fert: 0 },
    { label: "Seedling", fert: 500 },
    { label: "Sapling", fert: 1050 },
    { label: "Young elm", fert: 1600 },
    { label: "Mature elm", fert: 2150 },
    { label: "Giant", fert: 2650 },
    { label: "Ancient elm", fert: TREE_GROWTH_TARGET },
  ],
  redwood: [
    { label: "Seed", fert: 0 },
    { label: "Seedling", fert: 380 },
    { label: "Sapling", fert: 850 },
    { label: "Young redwood", fert: 1350 },
    { label: "Mature redwood", fert: 1900 },
    { label: "Giant", fert: 2450 },
    { label: "Ancient redwood", fert: TREE_GROWTH_TARGET },
  ],
};
