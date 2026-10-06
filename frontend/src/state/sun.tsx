/* ============================================================
   SUN — the Tree of Knowledge's shop economy and wisdom.

   Sun tokens are earned by playing (no purchases, no backend):
   a daily visit bonus, petting the companion, asking the help
   library, and one-time bounties for treasures, achievements,
   and tip milestones. Daily pet/question earnings are capped so
   the currency always comes from play, never from grinding.

   Fertilizer bought in the Lab's Sun Shop adds growth points
   (+2, for the stage/trivia tiers) and feet of height (+30). At
   100, 500, and 1000 feet the tree unlocks a typed CHEAT WORD;
   any other feeding dispenses the next stored garden tip, in
   order and without repeats. Cheats toggle real pet effects.

   Feeding wisdom is deterministic: the sample this is modeled on
   picks a random tip, but every sentence here is stored and
   rotated so nothing is invented and nothing repeats blindly.
   ============================================================ */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useHunt } from "./hunt";
import { useAchievements } from "./achievements";

const SPECIES_KEY_CHEAT = "paperrec_knowledge_species";

/** Each tree offers its own three cheat words. */
function currentCheatSet(): { word: string; effect: string }[] {
  try {
    const id = window.localStorage.getItem(SPECIES_KEY_CHEAT);
    if (id && CHEAT_SETS[id as TreeSpeciesId]) {
      return CHEAT_SETS[id as TreeSpeciesId];
    }
  } catch {
    // best-effort
  }
  return CHEAT_SETS.oak;
}

const STORAGE_KEY = "paperrec_sun";
const SEEN_TIPS_KEY = "paperrec_tips_seen";

import {
  CHEAT_HEIGHTS,
  CHEAT_SETS,
  DEFAULT_SPECIES,
  PROGRESS_LINES,
  SPECIES_STAGE_FERT,
  SPECIES_STAGE_LINES,
  treeHeightByFertilizer,
  type TreeSpeciesId,
} from "../data/knowledge";

export const DAILY_BONUS = 10;
export const PETS_PER_SUN = 10;
export const PET_SUN_CAP = 5;
export const ASK_SUN_CAP = 5;
export const TREASURE_BOUNTY = 5;
export const ACHIEVEMENT_BOUNTY = 5;
export const TIPS_PER_BOUNTY = 5;
export const TIP_BOUNTY = 2;
export const GROWTH_PER_FERTILIZER = 2;
export const FEET_PER_FERTILIZER = 30;
export const FEET_PER_POINT = 5;

export interface SunPack {
  count: 1 | 5 | 10;
  price: number;
  discount: string | null;
}

export const SUN_PACKS: SunPack[] = [
  { count: 1, price: 20, discount: null },
  { count: 5, price: 90, discount: "save 10%" },
  { count: 10, price: 160, discount: "save 20%" },
];

export interface CheatMilestone {
  height: number;
  word: string;
  effect: string;
}

export const CHEAT_MILESTONES: CheatMilestone[] = [
  {
    height: 100,
    word: "daisies",
    effect: "Papers the pet eats leave little daisies behind.",
  },
  {
    height: 500,
    word: "dance",
    effect: "The pet dances on the spot.",
  },
  {
    height: 1000,
    word: "pinata",
    effect: "Every paper the pet eats bursts into candy.",
  },
];

interface SunState {
  balance: number;
  /** Total sun spent on fertilizer (drives tree growth). */
  spent: number;
  /** The planted species; each tree grows its own garden bed. */
  species: TreeSpeciesId;
  /** Growth per species — every tree levels up separately. */
  gardenProgress: Record<TreeSpeciesId, number>;
  /** The active tree's fertilizer count (mirrored from the bed). */
  fertilizer: number;
  /** Growth tokens: the Skin Shop currency. */
  tokens: number;
  /** Grant registry keys: "once:<key>" or "daily:<day>:<key>". */
  tokenGrants: string[];
  /** Calendar day (UTC) the daily counters belong to. */
  day: string;
  /** Pets accumulated toward the next +1 sun. */
  pets: number;
  petsPaidToday: number;
  asksPaidToday: number;
  claimedTreasures: string[];
  claimedAchievements: string[];
  /** Sun already paid for tip milestones. */
  tipBounties: number;
  /** Tips discovered (mirrored here so height can include them). */
  tipsSeen: number;
  /** How many garden tips have been dispensed. */
  gardenTips: number;
  /** Cheat words unlocked by height. */
  cheats: string[];
  /** Cheat words armed by the user. */
  activeCheats: string[];
  /** Cheat words whose "bloomed" notice already fired — a cheat
      is announced once, ever, no matter how many times the tree
      re-crosses the milestone. */
  announcedCheats: string[];
}

const EMPTY_STATE: SunState = {
  balance: 0,
  spent: 0,
  species: DEFAULT_SPECIES,
  gardenProgress: {
    crimson: 0,
    oak: 0,
    birch: 0,
    elm: 0,
    redwood: 0,
  },
  fertilizer: 0,
  tokens: 0,
  tokenGrants: [],
  day: "",
  pets: 0,
  petsPaidToday: 0,
  asksPaidToday: 0,
  claimedTreasures: [],
  claimedAchievements: [],
  tipBounties: 0,
  tipsSeen: 0,
  gardenTips: 0,
  cheats: [],
  activeCheats: [],
  announcedCheats: [],
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readState(): SunState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;

    const parsed = JSON.parse(raw) as Partial<SunState>;
    const strings = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.filter((item) => typeof item === "string")
        : [];

    const species = (
      parsed.species &&
      ["crimson", "oak", "birch", "elm", "redwood"].includes(parsed.species)
    )
      ? (parsed.species as TreeSpeciesId)
      : DEFAULT_SPECIES;

    const fertilizer = Number(parsed.fertilizer) || 0;
    const gardenProgress = {
      crimson: Number((parsed as { gardenProgress?: Record<string, unknown> }).gardenProgress?.["crimson"]) || 0,
      oak: Number((parsed as { gardenProgress?: Record<string, unknown> }).gardenProgress?.["oak"]) || 0,
      birch: Number((parsed as { gardenProgress?: Record<string, unknown> }).gardenProgress?.["birch"]) || 0,
      elm: Number((parsed as { gardenProgress?: Record<string, unknown> }).gardenProgress?.["elm"]) || 0,
      redwood: Number((parsed as { gardenProgress?: Record<string, unknown> }).gardenProgress?.["redwood"]) || 0,
    } as Record<TreeSpeciesId, number>;

    /* Legacy saves: lift the old single count into the planted tree. */
    if (
      gardenProgress[species] === 0 &&
      Object.values(gardenProgress).every((v) => v === 0) &&
      fertilizer > 0
    ) {
      gardenProgress[species] = fertilizer;
    }

    return {
      balance: Number(parsed.balance) || 0,
      spent: Number(parsed.spent) || 0,
      species,
      gardenProgress,
      fertilizer: gardenProgress[species],
      tokens: Number(parsed.tokens) || 0,
      tokenGrants: strings(parsed.tokenGrants),
      day: typeof parsed.day === "string" ? parsed.day : "",
      pets: Number(parsed.pets) || 0,
      petsPaidToday: Number(parsed.petsPaidToday) || 0,
      asksPaidToday: Number(parsed.asksPaidToday) || 0,
      claimedTreasures: strings(parsed.claimedTreasures),
      claimedAchievements: strings(parsed.claimedAchievements),
      tipBounties: Number(parsed.tipBounties) || 0,
      tipsSeen: Number(parsed.tipsSeen) || 0,
      gardenTips: Number(parsed.gardenTips) || 0,
      cheats: strings(parsed.cheats),
      activeCheats: strings(parsed.activeCheats),
      announcedCheats: strings(parsed.announcedCheats),
    };
  } catch {
    return EMPTY_STATE;
  }
}

function writeState(state: SunState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // best-effort
  }
}

export function readSeenTipCount(): number {
  try {
    const raw = window.localStorage.getItem(SEEN_TIPS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/** Roll the daily counters and pay the visit bonus once per day. */
function rollDay(state: SunState): SunState {
  const day = today();
  if (state.day === day) return state;

  return {
    ...state,
    day,
    balance: state.balance + DAILY_BONUS,
    /* A fresh day pays +2 growth tokens (the skin currency). */
    tokens: state.tokens + 2,
    petsPaidToday: 0,
    asksPaidToday: 0,
  };
}

/** One-time bounties for treasures and achievements. */
function claimMilestones(
  state: SunState,
  treasures: readonly string[],
  achievements: readonly string[],
): SunState {
  const claimedTreasures = new Set(state.claimedTreasures);
  const claimedAchievements = new Set(state.claimedAchievements);
  let balance = state.balance;

  for (const id of treasures) {
    if (claimedTreasures.has(id)) continue;
    claimedTreasures.add(id);
    balance += TREASURE_BOUNTY;
  }

  for (const id of achievements) {
    if (claimedAchievements.has(id)) continue;
    claimedAchievements.add(id);
    balance += ACHIEVEMENT_BOUNTY;
  }

  if (
    claimedTreasures.size === state.claimedTreasures.length &&
    claimedAchievements.size === state.claimedAchievements.length &&
    balance === state.balance
  ) {
    return state;
  }

  return {
    ...state,
    balance,
    claimedTreasures: [...claimedTreasures],
    claimedAchievements: [...claimedAchievements],
  };
}

/** Tree height in feet — relative to the tree's stage: it climbs
 *  the stage ladder (Seed 0 ft … Ancient maple 1000 ft) as
 *  fertilizer marks progress, instead of a flat 30 ft per packet. */
export function treeHeight(
  state: Pick<SunState, "fertilizer" | "tipsSeen" | "species">,
  treasureCount: number,
  achievementCount: number,
): number {
  return treeHeightByFertilizer(state.fertilizer, state.species);
}

/** Unlock every cheat whose milestone the tree has reached. */
function unlockCheats(
  state: SunState,
  treasureCount: number,
  achievementCount: number,
): SunState {
  const height = treeHeight(state, treasureCount, achievementCount);
  const set = currentCheatSet();
  const reached = set
    .filter((_, index) => height >= CHEAT_HEIGHTS[index])
    .map((milestone) => milestone.word);

  const cheats = new Set(state.cheats);
  const before = cheats.size;

  for (const word of reached) cheats.add(word);

  if (cheats.size === before) return state;

  return { ...state, cheats: [...cheats] };
}

function reconcile(
  state: SunState,
  treasures: readonly string[],
  achievements: readonly string[],
): SunState {
  const base = unlockCheats(
    claimMilestones(rollDay(state), treasures, achievements),
    treasures.length,
    achievements.length,
  );

  /* One-time growth tokens for newly found treasures and
     achievements: claim whatever the grants registry lacks. */
  const newTreasures = treasures.filter(
    (entry) => !base.tokenGrants.includes(`once:treasure:${entry}`),
  );
  const newAchievements = achievements.filter(
    (entry) => !base.tokenGrants.includes(`once:achievement:${entry}`),
  );

  if (newTreasures.length + newAchievements.length === 0) {
    return base;
  }

  return {
    ...base,
    tokens: base.tokens + newTreasures.length + newAchievements.length,
    tokenGrants: [
      ...base.tokenGrants,
      ...newTreasures.map((entry) => `once:treasure:${entry}`),
      ...newAchievements.map((entry) => `once:achievement:${entry}`),
    ],
  };
}


interface BuyResult {
  ok: boolean;
  text: string;
  /** Cheat words unlocked by this purchase, if any. */
  unlocked: string[];
}

interface SunContextValue {
  balance: number;
  /** Total sun spent on fertilizer (tree growth driver). */
  spent: number;
  /** Growth tokens: the Skin Shop currency. */
  tokens: number;
  fertilizer: number;
  /** Growth the tree gains from bought fertilizer. */
  bonusGrowth: number;
  /** Tree height in feet. */
  height: number;
  /** Next height milestone, or undefined when everything blooms. */
  nextMilestone: CheatMilestone | undefined;
  cheats: string[];
  activeCheats: string[];
  packs: SunPack[];
  buy: (count: 1 | 5 | 10) => BuyResult;
  redeemCheat: (word: string) => { ok: boolean; text: string };
  trackPet: () => void;
  trackAsk: () => void;
  /** Pay tip-milestone bounties for `tips` discovered tips. */
  syncProgress: (tips: number) => void;
  /** Grant growth tokens (one-time by key and/or capped per day). */
  grantTokens: (
    amount: number,
    onceKey?: string,
    dailyKey?: string,
  ) => number;
  /** Spend growth tokens; returns true when the wallet covered it. */
  spendTokens: (amount: number) => boolean;
  /** Reset the tree's growth progress (fertilizer + spent sun). */
  resetTree: () => void;
  /** Plant a species; each tree keeps its own growth. */
  plantSpecies: (id: TreeSpeciesId) => void;
  /** TEMPORARY: dev top-up for shop/tree testing. */
  /** The planted tree's own cheat words. */
  cheatSet: { word: string; effect: string }[];
  testTopUp: (sunAmount: number, tokenAmount: number) => void;
}

const SunContext = createContext<SunContextValue | null>(null);

export function SunProvider({ children }: { children: ReactNode }) {
  const { found } = useHunt();
  const { unlocked } = useAchievements();
  const [state, setState] = useState<SunState>(readState);

  useEffect(() => {
    writeState(state);
  }, [state]);

  /* Daily bonus, bounties, and cheat unlocks whenever progress
     changes. */
  useEffect(() => {
    setState((current) => reconcile(current, found, unlocked));
  }, [found, unlocked]);

  const height = treeHeight(state, found.length, unlocked.length);
  const set = currentCheatSet();
  const nextMilestone = CHEAT_HEIGHTS.map((heightFt, index) => ({
    height: heightFt,
    word: set[index]?.word ?? "",
    effect: set[index]?.effect ?? "",
  })).find((milestone) => height < milestone.height);

  function grantTokens(
    amount: number,
    onceKey?: string,
    dailyKey?: string,
  ): number {
    let granted = 0;

    setState((current) => {
      const rolled = rollDay(current);

      if (onceKey && rolled.tokenGrants.includes(`once:${onceKey}`)) {
        return rolled;
      }

      if (
        dailyKey &&
        rolled.tokenGrants.includes(`daily:${today()}:${dailyKey}`)
      ) {
        return rolled;
      }

      granted = amount;

      return {
        ...rolled,
        tokens: rolled.tokens + amount,
        tokenGrants: [
          ...rolled.tokenGrants,
          onceKey
            ? `once:${onceKey}`
            : `daily:${today()}:${dailyKey ?? "misc"}`,
        ],
      };
    });

    return granted;
  }

  /* TEMPORARY test wallet: keystroke-free top-ups for shop and
     tree testing. Remove with the Test wallet strip in the Sun Shop. */
  function testTopUp(sunAmount: number, tokenAmount: number) {
    setState((current) => {
      const rolled = rollDay(current);
      return {
        ...rolled,
        balance: rolled.balance + sunAmount,
        tokens: rolled.tokens + tokenAmount,
      };
    });
  }

  /* Wipe every tree's progress: fertilizer and growth spent —
     the wallet, skins, and achievements stay. */
  function resetTree() {
    setState((current) => ({
      ...current,
      fertilizer: 0,
      spent: 0,
      gardenProgress: {
        crimson: 0,
        oak: 0,
        birch: 0,
        elm: 0,
        redwood: 0,
      },
    }));
  }

  /* Plant another species: the garden remembers each tree's own
     growth, so one tree can be a sapling while others are giants. */
  function plantSpecies(id: TreeSpeciesId) {
    setState((current) => ({
      ...current,
      species: id,
      fertilizer: current.gardenProgress[id] ?? 0,
    }));
  }

  function spendTokens(amount: number): boolean {
    let ok = false;

    setState((current) => {
      const rolled = rollDay(current);
      if (rolled.tokens < amount) {
        ok = false;
        return rolled;
      }
      ok = true;
      return { ...rolled, tokens: rolled.tokens - amount };
    });

    return ok;
  }

  function buy(count: 1 | 5 | 10): BuyResult {
    const pack = SUN_PACKS.find((entry) => entry.count === count);
    if (!pack) {
      return { ok: false, text: "Unknown pack.", unlocked: [] };
    }

    if (state.balance < pack.price) {
      return {
        ok: false,
        text: `Not enough sun — ${pack.price - state.balance} more needed.`,
        unlocked: [],
      };
    }

    const before = height;
    const after = treeHeightByFertilizer(
      state.fertilizer + count,
      state.species,
    );
    const set = currentCheatSet();
    const crossed = CHEAT_HEIGHTS.filter(
      (heightFt) => heightFt > before && heightFt <= after,
    ).map((heightFt, index) => ({
      height: heightFt,
      word: set[index]?.word ?? "",
      effect: set[index]?.effect ?? "",
    }));

    /* A cheat is announced the first time its milestone is really
       achieved — never on re-crossings, never twice. */
    const already = new Set(state.announcedCheats);
    const fresh = crossed.filter(
      (milestone) =>
        milestone.word !== "" && !already.has(milestone.word),
    );

    let wisdom: string;

    if (fresh.length > 0) {
      wisdom = fresh
        .map(
          (milestone) =>
            `Cheat unlocked: type "${milestone.word}" — ${milestone.effect}`,
        )
        .join(" ");
    } else {
      /* A stage cleared speaks its own line... */
      const ferts = SPECIES_STAGE_FERT[state.species];
      const stageNow = ferts.filter((f) => f <= state.fertilizer).length - 1;
      const stageAfter = ferts.filter((f) => f <= state.fertilizer + count).length - 1;
      if (stageAfter > stageNow) {
        wisdom = SPECIES_STAGE_LINES[state.species][
          Math.min(stageAfter, SPECIES_STAGE_LINES[state.species].length - 1)
        ];
      } else {
        /* ...between stages, honest progress to the next one. */
        const nextFert = ferts.find((f) => f > state.fertilizer + count);
        if (nextFert !== undefined) {
          const gap = treeHeightByFertilizer(nextFert, state.species) - after;
          wisdom = `${PROGRESS_LINES[state.gardenTips % PROGRESS_LINES.length]} ${gap} ft to the next stage.`;
        } else {
          wisdom = PROGRESS_LINES[state.gardenTips % PROGRESS_LINES.length];
        }
      }
    }

    setState((current) => {
      const bed: Record<TreeSpeciesId, number> = {
        ...current.gardenProgress,
        [current.species]:
          (current.gardenProgress[current.species] ?? 0) + count,
      };
      const planted: SunState = {
        ...rollDay(current),
        balance: current.balance - pack.price,
        spent: current.spent + pack.price,
        gardenProgress: bed,
        fertilizer: bed[current.species],
        gardenTips: fresh.length > 0 ? current.gardenTips : current.gardenTips + 1,
        announcedCheats: fresh.length > 0
          ? [
              ...current.announcedCheats,
              ...fresh.map((milestone) => milestone.word),
            ]
          : current.announcedCheats,
      };

      return reconcile(planted, found, unlocked);
    });

    return {
      ok: true,
      text:
        `Planted ${count} fertilizer${count === 1 ? "" : "s"} — ` +
        `+${count * GROWTH_PER_FERTILIZER} growth — ` +
        `${after} ft. ${wisdom}`,
      unlocked: fresh.map((milestone) => milestone.word),
    };
  }

  function redeemCheat(word: string) {
    const normalized = word.trim().toLowerCase();
    if (!normalized) return { ok: false, text: "Type a cheat word." };

    if (!state.cheats.includes(normalized)) {
      return {
        ok: false,
        text: `The tree has not grown wise enough for "${normalized}" yet.`,
      };
    }

    const armed = state.activeCheats.includes(normalized);

    setState((current) => ({
      ...current,
      activeCheats: armed
        ? current.activeCheats.filter((entry) => entry !== normalized)
        : [...current.activeCheats, normalized],
    }));

    return {
      ok: true,
      text: armed
        ? `Cheat "${normalized}" disabled.`
        : `Cheat "${normalized}" armed!`,
    };
  }

  function trackPet() {
    setState((current) => {
      const rolled = rollDay(current);
      const pets = rolled.pets + 1;

      if (rolled.petsPaidToday >= PET_SUN_CAP || pets < PETS_PER_SUN) {
        return { ...rolled, pets };
      }

      return {
        ...rolled,
        pets: pets - PETS_PER_SUN,
        petsPaidToday: rolled.petsPaidToday + 1,
        balance: rolled.balance + 1,
      };
    });
  }

  function trackAsk() {
    setState((current) => {
      const rolled = rollDay(current);

      if (rolled.asksPaidToday >= ASK_SUN_CAP) return rolled;

      return {
        ...rolled,
        asksPaidToday: rolled.asksPaidToday + 1,
        balance: rolled.balance + 1,
      };
    });
  }

  function syncProgress(tips: number) {
    setState((current) => {
      const rolled = rollDay(current);
      const target =
        Math.floor(Math.max(0, tips) / TIPS_PER_BOUNTY) * TIP_BOUNTY;

      const withTips: SunState = {
        ...rolled,
        tipsSeen: Math.max(0, tips),
        balance:
          rolled.balance + Math.max(0, target - rolled.tipBounties),
        tipBounties: Math.max(rolled.tipBounties, target),
      };

      return reconcile(withTips, found, unlocked);
    });
  }

  return (
    <SunContext.Provider
      value={{
        balance: state.balance,
        spent: state.spent,
        tokens: state.tokens,
        fertilizer: state.fertilizer,
        bonusGrowth: state.fertilizer * GROWTH_PER_FERTILIZER,
        height,
        nextMilestone,
        cheatSet: currentCheatSet(),
        cheats: state.cheats,
        activeCheats: state.activeCheats,
        packs: SUN_PACKS,
        buy,
        redeemCheat,
        trackPet,
        trackAsk,
        syncProgress,
        grantTokens,
        spendTokens,
        testTopUp,
        resetTree,
        plantSpecies,
      }}
    >
      {children}
    </SunContext.Provider>
  );
}

export function useSun(): SunContextValue {
  const value = useContext(SunContext);

  if (value === null) {
    throw new Error("useSun must be used inside SunProvider.");
  }

  return value;
}
