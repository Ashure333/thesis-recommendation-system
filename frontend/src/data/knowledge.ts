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
  /** Trunk color (inline fill). */
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
    name: "American Elm",
    fact:
      "Ulmus americana — the elm of the cathedral arch, the vase " +
      "shape of its crown copied by every laid-out avenue.",
    research:
      "Dutch elm disease, a beetle-borne fungus, felled most of " +
      "its kind since the 1930s. A few resistant lines are being " +
      "planted back into the avenues it lost.",
  },
  redwood: {
    name: "Giant Redwood",
    fact:
      "Sequoia sempervirens — the tallest living thing ever " +
      "measured, standing in fog belts along the Pacific coast.",
    research:
      "Boughs almost a kilometer up, ringed like time itself. Its " +
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

/** Every line a tree can idly volunteer is a real fact about its
 *  own species, spoken in its own first-person voice — not a
 *  mystical riddle. The last line in every list is shared: it is
 *  how each species nods to the pet that keeps it company (see
 *  `data/petForms.ts` for the other half of that story). */
export const SPECIES_IDLE_LINES: Record<
  TreeSpeciesId,
  { text: string; topic: string }[]
> = {
  crimson: [
    { text: "My seeds spin like tiny helicopters — samaras, foresters call them.", topic: "Maple lore" },
    { text: "I turn red earliest of all the maples; some years by August.", topic: "Maple lore" },
    { text: "Tap my trunk in late winter and I'll give you sap, thinner than sugar maple's but sweet.", topic: "Maple lore" },
    { text: "I'll root in a bog or a dry ridge — I'm not picky about my feet.", topic: "Maple lore" },
    { text: "My flowers open before my leaves do, small and red, easy to miss.", topic: "Maple lore" },
    { text: "Across eastern North America, more of my kind grows than any other tree.", topic: "Maple lore" },
    { text: "A hard frost doesn't stop me — some years I flower with snow still on the ground.", topic: "Maple lore" },
    { text: "My wood is pale and close-grained, softer than sugar maple's, still good for a chair.", topic: "Maple lore" },
    { text: "A slime once slept in my roots, and it never quite left.", topic: "Grove lore" },
  ],
  oak: [
    { text: "More insects call an oak home than any other tree in these isles.", topic: "Oak lore" },
    { text: "My acorns ripen in a single season — some oaks make their children wait two.", topic: "Oak lore" },
    { text: "I can live past a thousand years; a handful of my kind in Europe already have.", topic: "Oak lore" },
    { text: "My timber resists rot: Viking ships and cathedral roofs were built from oaks like me.", topic: "Oak lore" },
    { text: "Jays bury my acorns and forget most of them. That's half my planting done for me.", topic: "Oak lore" },
    { text: "Wasp galls on my leaves once made the world's ink, iron gall ink, for centuries.", topic: "Oak lore" },
    { text: "I hold onto my dead leaves well into winter, longest on my youngest branches.", topic: "Oak lore" },
    { text: "My bark splits into deep ridges as I age — smooth bark always means a young oak.", topic: "Oak lore" },
    { text: "A slime once slept in my roots, and it never quite left.", topic: "Grove lore" },
  ],
  birch: [
    { text: "My bark peels in papery curls, thin enough that people once wrote letters on it.", topic: "Birch lore" },
    { text: "I'm often first back after a fire or a cleared field; foresters call that pioneering.", topic: "Birch lore" },
    { text: "My seeds are so light the wind carries them for miles, tucked in tiny winged nutlets.", topic: "Birch lore" },
    { text: "Tap me in early spring and clear sap runs. People call it birch water, and drink it.", topic: "Birch lore" },
    { text: "My roots don't go deep, but they spread wide, holding thin soils together.", topic: "Birch lore" },
    { text: "I rarely see a hundred years; I grow fast, and I go fast too.", topic: "Birch lore" },
    { text: "My bark holds betulin, a wax that sheds water and still catches a flame when wet.", topic: "Birch lore" },
    { text: "Finland calls me its national tree; more than one country claims me as home.", topic: "Birch lore" },
    { text: "A slime once slept in my roots, and it never quite left.", topic: "Grove lore" },
  ],
  elm: [
    { text: "My vase-shaped crown lined a thousand American streets before a blight found it.", topic: "Elm lore" },
    { text: "Dutch elm disease, a fungus a beetle carries, has killed most of my kind since the 1930s.", topic: "Elm lore" },
    { text: "A few of us carry resistance now, bred and planted back into the avenues we lost.", topic: "Elm lore" },
    { text: "My grain interlocks as it grows, hard to split: good for wheel hubs, and coffins too.", topic: "Elm lore" },
    { text: "Where the blight hasn't reached, I can live past two centuries.", topic: "Elm lore" },
    { text: "My flowers are small and reddish and open well before my leaves, easy to miss.", topic: "Elm lore" },
    { text: "My seeds ride flat papery wings, samaras like a maple's, just rounder.", topic: "Elm lore" },
    { text: "My wood resists rot underwater; old London ran its water mains through elm trunks.", topic: "Elm lore" },
    { text: "A slime once slept in my roots, and it never quite left.", topic: "Grove lore" },
  ],
  redwood: [
    { text: "The tallest of my kind, Hyperion, tops out near 380 feet, longer than a football field.", topic: "Redwood lore" },
    { text: "My bark can grow a foot thick, spongy and fire-resistant; fire passes more than it takes.", topic: "Redwood lore" },
    { text: "I don't live on rain alone: fog dripping off my needles can be half my summer drink.", topic: "Redwood lore" },
    { text: "My cousin, the giant sequoia, outweighs me; I'm only the tallest, not the biggest.", topic: "Redwood lore" },
    { text: "My seed is barely bigger than a tomato's, and from it I can grow past 300 feet.", topic: "Redwood lore" },
    { text: "I can resprout from a stump or a fallen branch — few conifers can do that.", topic: "Redwood lore" },
    { text: "My whole range hugs a narrow fog belt along the Pacific coast, rarely far from the sea.", topic: "Redwood lore" },
    { text: "The oldest of my kind have stood for more than two thousand years.", topic: "Redwood lore" },
    { text: "A slime once slept in my roots, and it never quite left.", topic: "Grove lore" },
  ],
};

/* ---------- per-species cheats and growth progress ---------- */

/** Cheat unlock heights, shared by every species and tuned to the REAL
 *  relative foot scale (ancient = 1000 ft). A cheat is a garden charm:
 *  a living or drawn element of the garden that the player can switch on
 *  and off once the tree is tall enough to hold it.
 *
 *    250 ft  ~ the Seedling/Sapling turn   charm 1  foliage
 *    450 ft  ~ the Sapling/Young turn      charm 2  plant
 *    650 ft  ~ the Young/Mature turn       charm 3  creature
 *    850 ft  ~ the Mature/Giant turn       charm 4  light and weather
 *   1000 ft  ~ the Ancient crown           charm 5  relic
 *
 *  Each tree has five of its own (see data/charms.ts for what each one
 *  draws). Arming a word toggles it in `activeCheats`; it stays armed
 *  until typed or switched off again. Each unlock is announced exactly
 *  once (announcedCheats). */
export const CHEAT_HEIGHTS = [250, 450, 650, 850, 1000];

/** Each tree offers its own five cheat words. */
export const CHEAT_SETS: Record<
  TreeSpeciesId,
  { word: string; effect: string }[]
> = {
  crimson: [
    { word: "keys", effect: "Maple keys whirl down from the crown, spinning like tiny helicopters." },
    { word: "creeper", effect: "Scarlet Virginia creeper winds up the trunk, red as the maple's own leaves." },
    { word: "squirrel", effect: "A red squirrel takes up residence on the trunk and flicks its tail at you." },
    { word: "blaze", effect: "The autumn glow: embers of red and gold rise through the crown." },
    { word: "syrup", effect: "A sap bucket hangs from a tap in the trunk, dripping real maple syrup." },
  ],
  oak: [
    { word: "mast", effect: "Acorns ripen in the crown and drop, the way a jay remembers them." },
    { word: "daisies", effect: "A ring of oxeye daisies blooms at the foot of the oak." },
    { word: "jay", effect: "A blue jay hops about the roots, burying acorns it will forget." },
    { word: "dapple", effect: "Light dapples through the leaves and drifts across the ground and bark." },
    { word: "hollow", effect: "A knothole opens in the bark, with two owl eyes blinking inside." },
  ],
  birch: [
    { word: "catkins", effect: "Catkins hang from the twigs and sway, pale gold tassels in the wind." },
    { word: "anemone", effect: "Wood anemones star the ground in white, the birch wood's first spring flower." },
    { word: "woodpecker", effect: "A woodpecker taps at the trunk, chips flying, red cap bobbing." },
    { word: "moonbeam", effect: "Silver light slants through the crown, with pale motes drifting in it." },
    { word: "ribbons", effect: "Strips of birch bark curl away from the trunk and flutter like ribbons." },
  ],
  elm: [
    { word: "coins", effect: "Elm seeds drift down like papery coins, each one a tiny round wing." },
    { word: "wisteria", effect: "Wisteria swags hang from the boughs in violet, thick with blossom." },
    { word: "oriole", effect: "An oriole's woven nest hangs from a bough, the bird singing beside it." },
    { word: "shade", effect: "A cool arch of shade falls over the avenue, dappled and dim." },
    { word: "lantern", effect: "An old iron lamp glows beside the tree, as it did along the elm avenues." },
  ],
  redwood: [
    { word: "drip", effect: "Fog condenses on the needles and falls in slow drops." },
    { word: "ferns", effect: "Sword ferns arch around the roots, the redwood understory." },
    { word: "slug", effect: "A banana slug crawls up the bark, leaving a shining trail." },
    { word: "mist", effect: "Coastal fog drifts low through the grove, thickest at the ground." },
    { word: "grove", effect: "A ring of young redwood sprouts stands around the elder, family circle." },
  ],
};

/** Dedicated lines for each stage cleared (index 0 is the seed —
 *  spoken the moment the milestone is crossed, in the tree's own
 *  speech bubble). */
export const SPECIES_STAGE_LINES: Record<TreeSpeciesId, string[]> = {
  crimson: [
    "",
    "A Seedling maple. The first leaves uncurl toward the light.",
    "Sapling now. The trunk seals its first rings.",
    "Young maple. The canopy begins to arch overhead.",
    "Mature maple. My roots creep out and my boughs reach.",
    "Giant. The trunk towers and my crown hides in the clouds.",
    "Ancient maple. Every bough forks into a hundred twigs of fire.",
  ],
  oak: [
    "",
    "A Seedling oak. One small true leaf, already stubborn.",
    "Sapling oak. The bark starts its deep furrows.",
    "Young oak. The crown rounds out over the glade.",
    "Mature oak. My roots grip the ground and my boughs spread.",
    "Giant. My boughs cast a very wide afternoon.",
    "Ancient oak. A landmark now, thick with leaf and patient.",
  ],
  birch: [
    "",
    "A Seedling birch. Silver already, and peeling.",
    "Sapling birch. The white bark catches the light.",
    "Young birch. The airy crown shimmers at the top.",
    "Mature birch. I rustle like paper, roots and all.",
    "Giant. The silver trunk bends to no storm.",
    "Ancient birch. Gold leaves on a thousand slender twigs.",
  ],
  elm: [
    "",
    "A Seedling elm. The arch dreams in its twigs.",
    "Sapling elm. The vase shape begins to show.",
    "Young elm. A fountain of branches overhead.",
    "Mature elm. My roots spread and the avenue gets its shade.",
    "Giant. My arch spans the whole walk.",
    "Ancient elm. The cathedral of the lane, in full leaf.",
  ],
  redwood: [
    "",
    "A Seedling redwood. Bound for the sky already.",
    "Sapling redwood. The red bark thickens.",
    "Young redwood. I outgrow the meadow's edge.",
    "Mature redwood. My roots meet the fog line.",
    "Giant. The tallest thing the coast has seen.",
    "Ancient redwood. The world tree crowns the sky.",
  ],
};

/** Honest between-stage whispers: no filler — real progress
 *  toward the next stage follows on every feed. */
export const PROGRESS_LINES = [
  "The crown rises. Every packet rings in the trunk.",
  "Roots settle deeper with each feed.",
  "The meadow grows small below the canopy.",
  "Growth is patient, but the rings keep their promise.",
  "A new twig forks. Each feed adds a little more branch.",
  "The vines climb a little higher with every feed.",
  "I can feel the clouds from up here. Keep feeding.",
];

/** What the tree says about itself at each growth stage (index 0 is the
 *  seed, 6 the ancient tree), in the tree's own first-person voice and
 *  describing what the garden is showing at that moment. They mix into
 *  the idle chatter alongside the species lore. */
export const STAGE_IDLE_LINES: { text: string; topic: string }[][] = [
  [
    { text: "Still a seed. Everything I'll be is folded in here.", topic: "Seed" },
    { text: "It's quiet down in the soil. I like it.", topic: "Seed" },
  ],
  [
    { text: "My first leaves are out. The light is enormous.", topic: "Seedling" },
    { text: "Small, but I'm already reaching up.", topic: "Seedling" },
  ],
  [
    { text: "My trunk is thickening. Feel the first ring?", topic: "Sapling" },
    { text: "Branches now. Not many, but they're mine.", topic: "Sapling" },
  ],
  [
    { text: "My crown is filling out. Birds are asking about it.", topic: "Young tree" },
    { text: "Every branch forks into two, and again, and again.", topic: "Young tree" },
  ],
  [
    { text: "My roots are creeping out across the ground. Watch them.", topic: "Mature" },
    { text: "Vines have found my bark. I let them stay.", topic: "Mature" },
    { text: "Look up. My crown is a shadow among the leaves.", topic: "Mature" },
  ],
  [
    { text: "Climb with me. The meadow shrinks below.", topic: "Giant" },
    { text: "Twigs sprout off my trunk like handwriting.", topic: "Giant" },
    { text: "My boughs are forking now, each one into two.", topic: "Giant" },
  ],
  [
    { text: "At the top the crown is thick with leaves and the clouds drift through.", topic: "Ancient" },
    { text: "Every bough forks into twigs, every twig into leaves.", topic: "Ancient" },
    { text: "You made it to the summit. The view is all leaf and sky.", topic: "Ancient" },
  ],
];

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

/** The stage index of a tree at a fertilizer count: 0 = Seed,
 *  3 = Young, 6 = Ancient. */
export function treeStageIndex(
  fert: number,
  species: TreeSpeciesId = DEFAULT_SPECIES,
): number {
  const markers = SPECIES_GROWTH_MARKERS[species];
  let stage = 0;

  for (const marker of markers) {
    if (fert >= marker.fert) {
      stage += 1;
    }
  }

  return Math.max(0, stage - 1);
}
