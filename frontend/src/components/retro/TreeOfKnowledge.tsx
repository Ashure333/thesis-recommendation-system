/* ============================================================
   TREE OF KNOWLEDGE — the Lab's knowledge garden.

   A Plants-vs-Zombies-style lawn: a seed bank of the four
   species across the top, a striped grass field, the planted
   tree on the left with its own speech bubble, and an "Ask the
   tree" button that hands out the next stored system trivia.

   Growth comes from real progress (treasures, achievements,
   discovered tips) and only changes the tree's size and the
   trivia tier it can answer; the species is cosmetic and
   persisted per browser. Nothing here is generated — every
   bubble is a stored trivia from data/trivia.ts.
   ============================================================ */

import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_SPECIES,
  KNOWLEDGE_STAGES,
  SPECIES_GROWTH_MARKERS,
  knowledgePoints,
  knowledgeStageFromHeight,
  nextKnowledgeHeight,
  nextTrivia,
  TREE_SPECIES,
  treeSpecies,
  type TreeSpeciesId,
} from "../../data/knowledge";
import { TRIVIA, type Trivia } from "../../data/trivia";
import { SPECIES_INFO } from "../../data/knowledge";
import { BACKDROP_THEMES, DEFAULT_BACKDROP_THEME } from "../../data/backdrops";
import type { BackdropThemeId } from "../../data/backdrops";
import { useHunt } from "../../state/hunt";
import { useAchievements } from "../../state/achievements";
import { readSeenTipCount, useSun } from "../../state/sun";
import { addOwnedSkin, SKINS_KEY, useOwnedSkins } from "../../state/skins";
import {
  TREE_GROWTH_TARGET,
  treeHeightByFertilizer,
  TREE_IDLE_LINES,
  TREE_SKIN_PRICES,
} from "../../data/knowledge";
import KnowledgeTree from "./KnowledgeTree";
import PixelGrowthTree from "./PixelGrowthTree";
import GardenBackdrop from "./GardenBackdrop";
import SunShop from "./SunShop";
import ThemeShop from "./ThemeShop";
import SparkleGlyph from "./SparkleGlyph";
import SunGlyph from "./SunGlyph";
import TokenGlyph from "./TokenGlyph";
import RetroDialog from "./RetroDialog";

const BACKDROP_THEMES_KEY = "paperrec_backdrop_themes";
const BACKDROP_ACTIVE_KEY = "paperrec_backdrop_theme";

const TRIVIA_KEY = "paperrec_knowledge_trivia";
const LEGACY_TRIVIA_KEY = "paperrec_wisdom_trivia";
/* Each species' tree learns its OWN trunk of trivia: the bank maps
   species id -> learned trivia ids. The old global list migrates
   into the starter maple's trunk. */
const TRIVIA_BANK_KEY = "paperrec_knowledge_trivia_bank";
const SPECIES_KEY = "paperrec_knowledge_species";
const ASKS_KEY = "paperrec_tree_asks";

const LAWN_COLS = 5;
const LAWN_ROWS = 4;

function emptyBank(): Record<TreeSpeciesId, string[]> {
  return {
    crimson: [],
    oak: [],
    birch: [],
    elm: [],
    redwood: [],
  };
}

function readTriviaBank(): Record<TreeSpeciesId, string[]> {
  try {
    const raw = window.localStorage.getItem(TRIVIA_BANK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const bank = emptyBank();
        for (const id of Object.keys(bank) as TreeSpeciesId[]) {
          const list = parsed[id];
          bank[id] = Array.isArray(list)
            ? list.filter((value) => typeof value === "string")
            : [];
        }
        return bank;
      }
    }
    /* No bank yet: migrate the old single trunk into the starter
       maple so nothing already learned is lost. */
    const legacy = window.localStorage.getItem(TRIVIA_KEY) ??
      window.localStorage.getItem(LEGACY_TRIVIA_KEY);
    const bank = emptyBank();
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        bank[DEFAULT_SPECIES] = parsed.filter(
          (value) => typeof value === "string",
        );
      }
    }
    try {
      window.localStorage.setItem(TRIVIA_BANK_KEY, JSON.stringify(bank));
    } catch {
      // best-effort
    }
    return bank;
  } catch {
    return emptyBank();
  }
}

function writeTriviaBank(bank: Record<TreeSpeciesId, string[]>) {
  try {
    window.localStorage.setItem(TRIVIA_BANK_KEY, JSON.stringify(bank));
    window.localStorage.removeItem(TRIVIA_KEY);
    window.localStorage.removeItem(LEGACY_TRIVIA_KEY);
  } catch {
    // best-effort
  }
}

function readSpecies(): TreeSpeciesId {
  try {
    const raw = window.localStorage.getItem(SPECIES_KEY);
    if (raw && TREE_SPECIES.some((species) => species.id === raw)) {
      return raw as TreeSpeciesId;
    }
  } catch {
    // best-effort
  }
  return DEFAULT_SPECIES;
}

function writeSpecies(id: TreeSpeciesId) {
  try {
    window.localStorage.setItem(SPECIES_KEY, id);
  } catch {
    // best-effort
  }
}


function readAskCount(): number {
  try {
    return Number(window.localStorage.getItem(ASKS_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeAskCount(count: number) {
  try {
    window.localStorage.setItem(ASKS_KEY, String(count));
  } catch {
    // best-effort
  }
}

export default function TreeOfKnowledge({
  onOpenShop,
  hideMarkers = false,
}: {
  /** Jump to the Sun Shop tab (the tree's growth store). */
  onOpenShop?: () => void;
  /** Hide the inline marker chips (shown in the Garden band). */
  hideMarkers?: boolean;
}) {
  const { count: treasures } = useHunt();
  const { unlocked } = useAchievements();
  const {
    bonusGrowth,
    balance,
    height,
    fertilizer,
    spent,
    tokens,
    grantTokens,
    spendTokens,
    buy,
    resetTree,
    plantSpecies,
  } = useSun();

  const [triviaBank, setTriviaBank] = useState<Record<TreeSpeciesId, string[]>>(
    readTriviaBank,
  );
  /* Dropping a fertilizer pack feeds the tree; the outcome echoes
     in the speech bubble. */
  const [feedNote, setFeedNote] = useState<string | null>(null);

  /* The tree card's own menu: the shop, skins, and wallet panes. */
  const [menu, setMenu] = useState<
    "info" | "shop" | "skins" | "themes" | "wallet" | null
  >(null);
  /* "Get info" reveals the research the tree holds; the default
     sidebar itself always shows the tree's name and fact card. */
  const [infoExpanded, setInfoExpanded] = useState(false);

  /* Backdrop themes: Meadow is the default; the Theme shop adds
     and applies the rest. */
  const [themes, setThemes] = useState<BackdropThemeId[]>(() => {
    try {
      const raw = window.localStorage.getItem(BACKDROP_THEMES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        const ids = parsed.filter((id): id is BackdropThemeId =>
          BACKDROP_THEMES.some((theme) => theme.id === id),
        );
        if (ids.length > 0) return ids;
      }
    } catch {
      // best-effort
    }
    return [DEFAULT_BACKDROP_THEME];
  });
  const [activeTheme, setActiveTheme] = useState<BackdropThemeId>(() => {
    try {
      const raw = window.localStorage.getItem(BACKDROP_ACTIVE_KEY);
      if (raw && BACKDROP_THEMES.some((theme) => theme.id === raw)) {
        return raw as BackdropThemeId;
      }
    } catch {
      // best-effort
    }
    return DEFAULT_BACKDROP_THEME;
  });
  function adoptTheme(
    nextOwned: BackdropThemeId[],
    nextActive: BackdropThemeId,
  ) {
    setThemes(nextOwned);
    setActiveTheme(nextActive);
    try {
      window.localStorage.setItem(BACKDROP_THEMES_KEY, JSON.stringify(nextOwned));
      window.localStorage.setItem(BACKDROP_ACTIVE_KEY, nextActive);
    } catch {
      // best-effort
    }
  }

  /* The tall tree window fits the stage's height. */
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageH, setStageH] = useState(0);
  useEffect(() => {
    const node = stageRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const measure = () => setStageH(node.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  /* Themed confirm / notice pop-ups (no browser dialogs). */
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    onYes: () => void;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  /* Toggled growth preview: tapping a stage chip shows the tree
     as it looks at that stage; tapping again returns to live. */
  const [previewStage, setPreviewStage] = useState<number | null>(null);

  
  const dropDepthRef = useRef(0);
  const [speciesId, setSpeciesId] =
    useState<TreeSpeciesId>(readSpecies);
  /* The ACTIVE tree's own trunk; every species keeps its own. */
  const seenTrivia = triviaBank[speciesId] ?? [];
  const [current, setCurrent] = useState<Trivia | null>(null);
  const [tipsSeen] = useState<number>(readSeenTipCount);
  const ownedSkins = useOwnedSkins();

  /* The tree's growth: sun consumed by fertilizer, then extra sun
     zooms into the world tree. */
  /* Every fertilizer is one step on the original's growth
     timeline: 3,000 packets take the tree from seed to ancient,
     extra packets beyond that rise into the world tree. */
  const growth = Math.min(1, fertilizer / TREE_GROWTH_TARGET);

/* The tree morphs between stages: every chip press animates the
     climb up or the descent down — never a jump. */
  const [morphG, setMorphG] = useState(growth);
  const morphRef = useRef(growth);
  morphRef.current = morphG;
  /* Bump to recentre the pan when a stage chip navigates. */
  const [viewReset, setViewReset] = useState(0);
  /* Cheat-bloom burst: a golden ring + the word + extra sparkles. */
  const [cheatFx, setCheatFx] = useState<{
    id: number;
    word: string;
  } | null>(null);
  const fxId = useRef(0);
  function triggerCheatFx(word: string) {
    const id = fxId.current + 1;
    fxId.current = id;
    setCheatFx({ id, word });
    spawnSparkles(16);
    window.setTimeout(() => {
      setCheatFx((current) => (current?.id === id ? null : current));
    }, 1800);
  }
  useEffect(() => {
    const to =
      previewStage === null
        ? growth
        : growthMarkers[previewStage].fert / TREE_GROWTH_TARGET;
    const from = morphRef.current;
    if (Math.abs(from - to) < 0.001) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 900);
      const ease = t * t * (3 - 2 * t);
      setMorphG(from + (to - from) * ease);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewStage, growth]);

  const growthMarkers = SPECIES_GROWTH_MARKERS[speciesId];
  const activeMarker = [...growthMarkers]
    .reverse()
    .find((marker) => fertilizer >= marker.fert);
  function resetTreeProgress() {
    setConfirm({
      title: "Reset the tree",
      body:
        "Wipe the garden? Trivia, fertilizer, growth, species, and " +
        "skins reset — sun, tokens, and the pet stay. The starter " +
        "maple grows back from its seed.",
      onYes: () => {
        doResetTreeProgress();
      },
    });
  }

  function doResetTreeProgress() {

    try {
      window.localStorage.removeItem(TRIVIA_KEY);
      window.localStorage.removeItem(LEGACY_TRIVIA_KEY);
      window.localStorage.removeItem(TRIVIA_BANK_KEY);
      window.localStorage.removeItem(ASKS_KEY);
      window.localStorage.removeItem(SPECIES_KEY);
      window.localStorage.removeItem(SKINS_KEY);
      window.localStorage.removeItem("paperrec_tree_size");
    } catch {
      // best-effort

    }

    setTriviaBank(emptyBank());
    writeTriviaBank(emptyBank());
    setCurrent(null);
    setFeedNote(null);
    setIdleLine(null);
    setBubbleClosed(false);
    resetTree();

    /* A fresh mount reflects the cleared species and skins: reload
       (the growth also replays from the seed — ideal for testing). */
    window.setTimeout(() => window.location.reload(), 250);
  }

  /* Interaction sparkles. */
  const [sparkles, setSparkles] = useState<
    { id: number; x: number; y: number }[]
  >([]);
  const sparkleId = useRef(0);


  function spawnSparkles(count: number) {
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const items = Array.from({ length: count }, () => ({
      id: sparkleId.current++,
      x: Math.round(Math.random() * 70 - 35),
      y: Math.round(Math.random() * 30 - 15),
    }));

    setSparkles((current) => [...current, ...items]);

    const ids = new Set(items.map((item) => item.id));
    window.setTimeout(
      () =>
        setSparkles((current) =>
          current.filter((sparkle) => !ids.has(sparkle.id)),
        ),
      1000,
    );
  }

  const earnedPoints = knowledgePoints({
    treasures,
    achievements: unlocked.length,
    tips: tipsSeen,
  });
  const points = earnedPoints + bonusGrowth;
  /* The tree only knows as deep as it has grown: trivia tiers are
     capped by its height, not by abstract points. */
  const stage = knowledgeStageFromHeight(height);
  const handout = nextTrivia(stage, seenTrivia);
  const tree = treeSpecies(speciesId);

  const nextAt = nextKnowledgeHeight(height);

  function chooseSpecies(id: TreeSpeciesId) {
    setPreviewStage(null);
    setSpeciesId(id);
    writeSpecies(id);
    plantSpecies(id);
  }

  function buySkin(id: TreeSpeciesId) {
    const price = TREE_SKIN_PRICES[id];
    if (ownedSkins.includes(id)) return;

    const label = treeSpecies(id).label;

    setConfirm({
      title: "Buy this skin",
      body: `Adopt the ${label} for ${price} growth tokens? It unlocks in the seed bank and plants right away.`,
      onYes: () => {
        if (!spendTokens(price)) {
          setNotice(
            `Not enough growth tokens — ${price - tokens} more needed.` +
              " Earn more by using the app: daily visits, hunts, asks," +
              " treasures, and achievements all pay tokens.",
          );
          return;
        }
        addOwnedSkin(id);
        setSpeciesId(id);
        writeSpecies(id);
        plantSpecies(id);
        spawnSparkles(6);
      },
    });
  }

  /* The speech bubble rides the tree's crown: a seed's bubble sits
     low over the sprout, an elder's high under the canopy. */
  /* Always visible: the bubble rides the crown but stays clear of
     the marker chips below and the bed's top edge above — clamped
     so no text is ever covered or clipped at any canvas size. */
  const bubbleBottomPct = Math.max(
    32,
    Math.min(78, 18 + 58 * growth + Math.min(5, height / 200)),
  );

  function feedTree(count: 1 | 5 | 10) {
    const result = buy(count);
    setFeedNote(result.text);
    if (result.ok) {
      spawnSparkles(6);
    }
  }

  useEffect(() => {
    if (!feedNote) return;
    const id = window.setTimeout(() => setFeedNote(null), 4200);
    return () => window.clearTimeout(id);
  }, [feedNote]);

  function askTree() {
    const knowledgeHandout = nextTrivia(stage, seenTrivia);
    if (!knowledgeHandout) return;

    const nextSeen = [...seenTrivia, knowledgeHandout.trivia.id];
    setTriviaBank((bank) => {
      const next = { ...bank, [speciesId]: nextSeen };
      writeTriviaBank(next);
      return next;
    });
    setCurrent(knowledgeHandout.trivia);
    setBubbleClosed(false);
    spawnSparkles(5);

    /* Every 5th ask pays a growth token (capped per day). */
    const nextAsks = readAskCount() + 1;
    writeAskCount(nextAsks);
    if (nextAsks % 5 === 0) {
      grantTokens(1, undefined, "asks");
    }
  }

  /* ---- idle speech: like the pet, the tree speaks on its own.
     The trivia bubble auto-dismisses after a minute of idle, then
     ambient grove lines appear at random gates from 1 second to
     2 minutes, each held open briefly. ---- */
  const [idleLine, setIdleLine] = useState<{
    text: string;
    topic: string;
  } | null>(null);
  const [bubbleClosed, setBubbleClosed] = useState(false);
  /* The bubble rests after speaking: every whisper or trivia piece
     auto-closes on a random cooldown between 4 and 7 seconds. */
  useEffect(() => {
    if (bubbleClosed || (!feedNote && !current)) return;
    const delay = 4000 + Math.floor(Math.random() * 3000);
    const id = window.setTimeout(() => setBubbleClosed(true), delay);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedNote, current, bubbleClosed]);
  const hoverRef = useRef(false);

  useEffect(() => {
    if (bubbleClosed) return;

    if (current) {
      /* The trivia holds for a minute, then the tree falls silent. */
      const t = window.setTimeout(
        () => setCurrent(null),
        60_000,
      );
      return () => window.clearTimeout(t);
    }

    if (idleLine) {
      /* The line lingers a few seconds, then the tree hushes. */
      const t = window.setTimeout(
        () => setIdleLine(null),
        6_000 + Math.random() * 2_000,
      );
      return () => window.clearTimeout(t);
    }

    /* Random gate between lines: 1 second to 2 minutes. */
    const t = window.setTimeout(() => {
      if (hoverRef.current) {
        /* Someone is looking close: try again soon instead. */
        setIdleLine(null);
        return;
      }
      const line =
        TREE_IDLE_LINES[
          Math.floor(Math.random() * TREE_IDLE_LINES.length)
        ];
      setIdleLine(line);
    }, 1_000 + Math.random() * 119_000);
    return () => window.clearTimeout(t);
  }, [current, idleLine, bubbleClosed]);

  return (
    <div
      data-tree-card=""
      className="overflow-hidden rounded border-[3px] border-gray-900 bg-white"
    >
      {/* ---------------- menu bar: currency, menus, species ------ */}
      <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap border-b-[3px] border-gray-900 bg-accent px-3 py-2">
        <div className="flex items-center gap-1.5">
        <div
          className="flex items-center gap-1.5 rounded border-[3px] border-gray-900 bg-accentSoft px-2 py-1 font-mono text-xs font-bold text-[#2b3347]"
          title={`Growth points: ${earnedPoints} earned + ${bonusGrowth} from fertilizer`}
        >
          <SunGlyph />
          {points}
        </div>

        <button
          type="button"
          aria-pressed={menu === "shop"}
          onClick={() => setMenu(menu === "shop" ? null : "shop")}
          title="Sun shop — buy fertilizer"
          className={`flex items-center gap-1.5 rounded border-[3px] border-gray-900 px-2 py-1 font-mono text-xs font-bold transition-colors pixel-ease ${
            menu === "shop"
              ? "bg-white text-gray-900"
              : "bg-accentSoft text-[#2b3347] hover:brightness-105 hover:bg-accentSoft"
          }`}
        >
          <SunGlyph />
          {balance}
        </button>

        <button
          type="button"
          aria-pressed={menu === "skins"}
          onClick={() => setMenu(menu === "skins" ? null : "skins")}
          title="Tree skins — buy with growth tokens"
          className={`flex items-center gap-1.5 rounded border-[3px] border-gray-900 px-2 py-1 font-mono text-xs font-bold transition-colors pixel-ease ${
            menu === "skins"
              ? "bg-white text-gray-900"
              : "bg-accentSoft text-[#2b3347] hover:brightness-105 hover:bg-accentSoft"
          }`}
        >
          <TokenGlyph />
          {tokens}
        </button>

        <button
          type="button"
          aria-pressed={menu === "wallet"}
          onClick={() => setMenu(menu === "wallet" ? null : "wallet")}
          title="Test wallet (temporary)"
          className={`rounded border-[3px] border-gray-900 px-2 py-[5px] font-mono text-[10px] font-bold uppercase tracking-wider transition-colors pixel-ease ${
            menu === "wallet"
              ? "bg-white text-gray-900"
              : "bg-accentSoft text-[#2b3347] hover:brightness-105 hover:bg-accentSoft"
          }`}
        >
          Wallet
        </button>
        </div>

        {/* the species picker: character-selector cards */}
        <div
          role="group"
          aria-label="Species picker"
          className="flex items-center gap-1.5 overflow-x-auto"
          onKeyDown={(event) => {
            const owned = TREE_SPECIES.filter((sp) =>
              ownedSkins.includes(sp.id),
            );
            const index = owned.findIndex((sp) => sp.id === speciesId);
            if (event.key === "ArrowRight") {
              event.preventDefault();
              if (owned.length > 0) chooseSpecies(owned[(index + 1) % owned.length].id);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              if (owned.length > 0) {
                chooseSpecies(
                  owned[(index - 1 + owned.length) % owned.length].id,
                );
              }
            }
          }}
        >

        {TREE_SPECIES.map((species) => {
          const planted = species.id === speciesId;
          const owned = ownedSkins.includes(species.id);
          const price = TREE_SKIN_PRICES[species.id];

          if (owned) {
            return (
              <button
                key={species.id}
                type="button"
                onClick={() => chooseSpecies(species.id)}
                aria-pressed={planted}
                title={
                  planted
                    ? `${species.label} planted — swap with \u2190 \u2192`
                    : `Plant the ${species.label}`
                }
                className={`flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-lg border-[3px] px-1 py-1 transition-all duration-150 pixel-ease ${
                  planted
                    ? "border-gray-900 bg-accentSoft/65 text-[#2b3347] dark:text-onAccent shadow-[2px_2px_0_rgba(0,0,0,0.25)]"
                    : "border-gray-900 bg-accentSoft/60 text-[#453b2f] dark:text-onAccent opacity-75 hover:opacity-100"
                }`}
              >
                <KnowledgeTree
                  stage={stage}
                  species={species.id}
                  size={30}
                />
                <span className="font-mono text-[9px] font-bold uppercase text-gray-900">
                  {species.label}
                </span>
                <span
                  className={`font-mono text-[8px] font-bold uppercase ${
                    planted ? "text-[#3b6d11]" : "text-gray-700"
                  }`}
                >
                  {planted ? "planted" : "seed"}
                </span>
              </button>
            );
          }

          return (
            <button
              key={species.id}
              type="button"
              onClick={() => buySkin(species.id)}
              title={`Locked — buy the ${species.label} skin for ${price} growth tokens`}
              className="flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-lg border-[3px] border-dashed border-gray-600 bg-[#e0cfb8]/70 px-1 py-1 opacity-60 grayscale transition-all duration-150 pixel-ease hover:opacity-90 hover:grayscale-0"
            >
              <span
                className="flex h-[30px] items-center justify-center text-[13px] text-gray-600"
                aria-hidden="true"
              >
                {"\uD83D\uDD12"}
              </span>
              <span className="font-mono text-[9px] font-bold uppercase text-gray-700">
                {species.label}
              </span>
              <span className="font-mono text-[8px] font-bold uppercase text-accent">
                <TokenGlyph className="inline-block h-2.5 w-2.5" /> {price}
              </span>
            </button>
          );
        })}

        </div>

        <span className="ml-auto font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#f5e08a]">
          {KNOWLEDGE_STAGES[stage]}
          {" · "}
          {height} ft
          {" · "}
          {handout
            ? `${handout.learned}/${handout.eligible} learned`
            : "0/0 learned"}
        </span>
      </div>

      {/* ---------------- garden bed: the animated landscape ------ */}
      {/* the tree and its menus sit side by side so the pop-ups
          always fit within the window */}
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="relative w-full overflow-hidden px-3 pb-1.5 pt-6">
        {/* the landscape stage is an exact 16:9 box: wide enough to
            cover the column, never stretched, never letterboxed */}
        <div ref={stageRef} className="relative aspect-[16/9] w-full">
        <GardenBackdrop theme={activeTheme} parallax={morphG} />

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center justify-end pb-1">
          <div
            className={`relative transition-all duration-200 pixel-ease ${
              dropActive
                ? "rounded-xl ring-4 ring-[#f5e08a]/90 ring-offset-2 ring-offset-[#8a5a2b]/20"
                : ""
            }`}
            onMouseEnter={() => {
              hoverRef.current = true;
            }}
            onMouseLeave={() => {
              hoverRef.current = false;
            }}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes("application/x-fertilizer")) {
                return;
              }
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setDropActive(true);
            }}
            onDragEnter={(event) => {
              if (!event.dataTransfer.types.includes("application/x-fertilizer")) {
                return;
              }
              dropDepthRef.current += 1;
              setDropActive(true);
            }}
            onDragLeave={() => {
              dropDepthRef.current = Math.max(0, dropDepthRef.current - 1);
              if (dropDepthRef.current === 0) {
                setDropActive(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              dropDepthRef.current = 0;
              setDropActive(false);
              const raw = event.dataTransfer.getData(
                "application/x-fertilizer",
              );
              const count = Number(raw);
              if (count === 1 || count === 5 || count === 10) {
                feedTree(count);
              }
            }}
          >
            <PixelGrowthTree
              speciesId={speciesId}
              growth={morphG}
              viewerMax={stageH > 0 ? Math.round(stageH) - 6 : undefined}
              viewResetKey={viewReset}
              onTreeClick={() => setBubbleClosed(false)}
            />

            {/* the bubble's tail points at the crown; it climbs as
                the tree grows and settles under the canopy. Closing
                it (x) hides it entirely — even the prompt — so the
                grown tree can be admired; ask or click the tree to
                call it back. */}
            {!bubbleClosed && (
            <div
              className="absolute left-[calc(50%+3.5rem)] z-10 w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded border-[3px] border-gray-900 bg-white px-2.5 py-1.5 font-mono text-[11px] leading-4 text-ink shadow-[3px_3px_0_rgba(0,0,0,0.25)] transition-[bottom] duration-700 pixel-ease"
              data-tree-bubble
              style={{
                bottom: `${bubbleBottomPct}%`,
              }}
            >
              {feedNote ? (
                <>
                  <span className="font-bold">{feedNote}</span>
                  <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-muted">
                    Garden
                  </span>
                </>
              ) : current ? (
                <>
                  <span className="font-bold">{current.text}</span>
                  <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-muted">
                    {current.topic}
                    {" · "}
                    {tree.label}
                  </span>
                </>
              ) : idleLine ? (
                <>
                  <span className="font-bold">{idleLine.text}</span>
                  <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-muted">
                    {idleLine.topic}
                  </span>
                </>
              ) : (
                <span className="text-muted">
                  Ask the tree for a piece of system knowledge.
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setCurrent(null);
                  setIdleLine(null);
                  setBubbleClosed(true);
                }}
                title="Close the speech bubble to see the tree"
                aria-label="Close speech bubble"
                className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded border-[2px] border-gray-900 bg-white font-mono text-[11px] font-bold leading-none text-ink transition-colors pixel-ease hover:bg-accentSoft"
              >
                {"\u00D7"}
              </button>
              <span
                aria-hidden="true"
                className="absolute -bottom-[9px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b-[3px] border-r-[3px] border-gray-900 bg-white"
              />
            </div>
            )}


            {/* ground shadow stays put; the canvas tree adds its own */}
            <span
              aria-hidden="true"
              className="absolute -bottom-1 left-1/2 h-2 w-20 -translate-x-1/2 rounded-full bg-black/20"
            />

              {/* cheat bloom: ring + word burst */}
            {cheatFx && (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
                <span
                  aria-hidden="true"
                  className="absolute h-40 w-40 animate-ping rounded-full border-4 border-[#f0c161] opacity-70"
                />
                <span
                  className="animate-pulse rounded-lg border-[3px] border-gray-900 bg-white/95 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent shadow-[3px_3px_0_rgba(0,0,0,0.2)]"
                >
                  Cheat unlocked — {"\u201C"}{cheatFx.word}{"\u201D"}
                </span>
              </div>
            )}

            {/* sparkle burst when the tree dispenses trivia */}
            {sparkles.map((sparkle) => (
              <span
                key={sparkle.id}
                aria-hidden="true"
                className="sparkle-pop pointer-events-none absolute top-8 z-10"
                style={{
                  left: `calc(50% + ${sparkle.x}px)`,
                  marginTop: sparkle.y,
                }}
              >
                <SparkleGlyph />
              </span>
            ))}
          </div>
        </div>
            {/* growth markers: the tree visibly grows at each sun value;
                relocated to the top-left corner of the meadow as a
                toggleable stage strip */}
            {!hideMarkers && (
            <div className="absolute left-2 top-2 z-20 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-1">
              {growthMarkers.map((marker, index) => {
                const reached = fertilizer >= marker.fert;
                const live = activeMarker?.label === marker.label;
                const active = previewStage === index;
                const nextFert =
                  growthMarkers[index + 1]?.fert ?? marker.fert;

                return (
                  <button
                    key={marker.label}
                    type="button"
                    aria-pressed={active}
                    title={
                      active
                        ? "Back to the tree as it grows"
                        : `Preview the ${marker.label} stage`
                    }
                    onClick={() => {
                      setPreviewStage(active ? null : index);
                      setViewReset((n) => n + 1);
                    }}
                    className={`retro-shadow-light flex items-center gap-1 rounded-md border-[2px] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide transition-colors pixel-ease ${
                      active ? "animate-pulse" : ""
                    }
                    ${
                      active
                        ? "border-gray-900 bg-accent text-[#2b3347] shadow-[2px_2px_0_rgba(0,0,0,0.2)]"
                        : live
                          ? "border-gray-900 bg-accentSoft text-[#2b3347]"
                          : reached
                            ? "border-[#4a7a2f] bg-accentSoft text-[#2b6e1e] hover:bg-[#dff0d2]"
                            : "border-gray-300/80 bg-white/85 text-[#6a6053] dark:bg-[#241c12]/90 dark:text-[#cfc3b4] hover:border-gray-900 hover:text-gray-800"
                    }`}
                  >
                    <span aria-hidden="true" className="text-[8px]">
                      {reached
                        ? "\u2713"
                        : index === growthMarkers.length - 1
                          ? "\u2605"
                          : "\u25CB"}
                    </span>
                    {marker.label}
                    {!reached && (
                      <span className="opacity-60">
                        {"\u00B7"}{" "}
                        {treeHeightByFertilizer(nextFert, speciesId) -
                          treeHeightByFertilizer(fertilizer, speciesId)}{" "}
                        ft
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            )}
        </div>
      </div>

{/* the sidebar: the tree's info by default, the shops on
          request; same height as the tree column either way */}
      <aside
        aria-label="Tree sidebar"
        className="overflow-hidden border-t-[3px] border-gray-900 md:h-[500px] md:border-l-[3px] md:border-t-0"
      >
        <div className="flex h-[49px] items-center justify-between gap-3 border-b-[3px] border-gray-900 bg-gradient-to-b from-accent to-accent/70 px-3 py-2">
          <p className="retro-shadow-dark truncate font-mono text-xs font-bold uppercase tracking-[0.15em] text-onAccent">
            {menu === "shop"
              ? "Sun shop"
              : menu === "skins"
                ? "Tree skins"
                : menu === "themes"
                  ? "Theme shop"
                  : menu === "wallet"
                    ? "Token wallet"
                    : "Tree info"}
          </p>
          <span className="flex items-center gap-2">
            {menu === "shop" && (
              <span
                className="flex items-center gap-1.5 rounded border-[3px] border-gray-900 bg-accentSoft px-2 py-1 font-mono text-xs font-bold text-[#2b3347]"
                title="Your sun tokens"
              >
                <SunGlyph />
                {balance}
              </span>
            )}
            {menu === "skins" && (
              <span
                className="flex items-center gap-1.5 rounded border-[3px] border-gray-900 bg-accentSoft px-2 py-1 font-mono text-xs font-bold text-[#2b3347]"
                title="Your growth tokens"
              >
                <TokenGlyph />
                {tokens}
              </span>
            )}
            <button
              type="button"
              onClick={() => setMenu(null)}
              aria-label="Close sidebar"
              title="Back to the tree info"
              className="grid h-5 w-5 place-items-center rounded border-[2px] border-onAccent/80 font-mono text-[11px] font-bold leading-none text-onAccent transition-colors pixel-ease hover:bg-onAccent/15"
            >
              {"×"}
            </button>
          </span>
        </div>

        {/* picker rail: info + the three shops */}
        <div
          role="group"
          aria-label="Tree sidebar menus"
          className="flex w-full gap-2 overflow-x-auto border-b-[3px] border-gray-900 bg-accentSoft/45 dark:bg-[#2c2413]/70 px-2 py-2"
          onKeyDown={(event) => {
            const RAIL = [
              { id: "info", label: "Tree info" },
              { id: "shop", label: "Sun shop" },
              { id: "skins", label: "Tree skins" },
              { id: "themes", label: "Themes" },
              { id: "wallet", label: "Wallet" },
            ] as const;
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
              return;
            }
            event.preventDefault();
            const index = RAIL.findIndex((entry) => entry.id === menu);
            const next =
              event.key === "ArrowRight"
                ? RAIL[(index + 1) % RAIL.length].id
                : RAIL[(index - 1 + RAIL.length) % RAIL.length].id;
            setMenu(next);
          }}
        >
          {(
            [
              { id: "info", label: "Tree info", glyph: "i" },
              { id: "shop", label: "Sun shop", glyph: "\u2600" },
              { id: "skins", label: "Tree skins", glyph: "\uD83C\uDF33" },
              { id: "themes", label: "Themes", glyph: "\u25C8" },
              { id: "wallet", label: "Wallet", glyph: "\u25C6" },
            ] as const
          ).map((entry) => {
            const active = (menu ?? "info") === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={active}
                onClick={() => setMenu(entry.id)}
                onKeyDown={(event) => {
                  if (
                    event.key !== "ArrowLeft" &&
                    event.key !== "ArrowRight"
                  ) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  const RAIL = [
                    { id: "info", label: "Tree info" },
                    { id: "shop", label: "Sun shop" },
                    { id: "skins", label: "Tree skins" },
                    { id: "themes", label: "Themes" },
                    { id: "wallet", label: "Wallet" },
                  ] as const;
                  const index = RAIL.findIndex(
                    (entry2) => entry2.id === menu,
                  );
                  const next =
                    event.key === "ArrowRight"
                      ? RAIL[(index + 1) % RAIL.length].id
                      : RAIL[(index - 1 + RAIL.length) % RAIL.length].id;
                  setMenu(next);
                }}
                title={`${entry.label} — press \u2190 \u2192 to switch`}
                className={`flex min-w-[68px] shrink-0 flex-col items-center gap-0.5 rounded-lg border-[3px] px-1.5 py-1 transition-all duration-150 pixel-ease ${
                  active
                    ? "border-gray-900 bg-white text-gray-900 shadow-[2px_2px_0_rgba(0,0,0,0.25)]"
                    : "border-gray-800/40 bg-white/60 text-gray-700/70 dark:bg-[#262015]/70 hover:border-gray-900 hover:text-gray-900"
                }`}
              >
                <span
                  className="grid h-7 w-7 place-items-center rounded border-[3px] font-mono text-[11px] font-bold"
                >
                  <span
                    className={`grid h-7 w-7 place-items-center rounded border-[3px] transition-colors ${
                      active
                        ? "border-gray-900 bg-accentSoft"
                        : "border-gray-700/40 bg-white/70"
                    }`}
                  >
                    {entry.glyph}
                  </span>
                </span>
                <span className="font-mono text-[9px] font-bold uppercase">
                  {entry.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="md:h-[376px] md:overflow-y-auto bg-white">
          {(menu === "info" || menu === null) && (
            <div className="p-4">
              <p className="font-pixelify text-lg font-bold leading-tight text-ink">
                {SPECIES_INFO[speciesId].name}
              </p>
              <p className="mt-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-accent">
                {treeSpecies(speciesId).label}
              </p>

              <p className="mt-3 text-xs leading-5 text-ink">
                {SPECIES_INFO[speciesId].fact}
              </p>

              {!infoExpanded ? (
                <button
                  type="button"
                  onClick={() => setInfoExpanded(true)}
                  className="mt-4 w-full rounded-lg border-[3px] border-gray-900 bg-accent px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#2b3347] shadow-[3px_3px_0_rgba(0,0,0,0.18)] transition-all pixel-ease hover:brightness-110 hover:bg-accent active:translate-y-[2px] active:shadow-none"
                >
                  Get info
                </button>
              ) : (
                <div>
                  <span
                    role="status"
                    className="mb-2 mt-4 inline-block rounded-md border-[2px] border-gray-900 bg-accentSoft px-2 py-1 font-mono text-[10px] font-bold text-[#2b6e1e]"
                  >
                    {handout && handout.eligible > 0
                      ? `${handout.learned}/${handout.eligible} learned`
                      : "0/0 learned"}
                  </span>

                  <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-wide text-muted">
                    Research on the tree
                  </p>
                  <p className="mt-1 text-xs leading-5 text-ink">
                    {SPECIES_INFO[speciesId].research}
                  </p>

                  <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-wide text-muted">
                    The trunk's knowledge
                  </p>
                  {seenTrivia.length === 0 ? (
                    <p className="mt-1 text-xs italic text-muted">
                      Nothing yet — ask the tree while it grows.
                    </p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-2">
                      {TRIVIA.filter((item) =>
                        seenTrivia.includes(item.id),
                      ).map((item) => (
                        <li
                          key={item.id}
                          className="rounded border-[2px] border-gray-900 bg-white px-2 py-1.5"
                        >
                          <p className="font-mono text-[9px] font-bold uppercase tracking-wide text-accent">
                            {item.topic}
                          </p>
                          <p className="text-[11px] leading-4 text-ink">
                            {item.text}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}

                  {nextAt !== undefined && (
                    <p className="mt-3 font-mono text-[9px] font-bold uppercase tracking-wider text-muted">
                      Next knowledge at {nextAt} ft — grow it to ask
                      deeper.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {menu === "themes" && (
            <ThemeShop
              owned={themes}
              active={activeTheme}
              onChanged={adoptTheme}
            />
          )}

          {menu !== null && menu !== "info" && menu !== "themes" && (
        <div className="bg-white">
            <SunShop
              embedded
              tab={menu}
              onSelect={(id) => setMenu(id)}
              hidePicker
              hidePreview
              onWhisper={(text) => {
                setFeedNote(text);
                setBubbleClosed(false);
              }}
              onCheatFx={triggerCheatFx}
            />
          </div>
          )}
        </div>
      </aside>
      </div>

      {/* centered action row under the bed */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 border-t-[3px] border-gray-900 bg-accentSoft px-4 py-3">

        <button
          type="button"
          onClick={askTree}
          className="retro-shadow-dark rounded-lg border-[3px] border-gray-900 bg-accent px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.1em] text-onAccent shadow-[3px_3px_0_rgba(0,0,0,0.18)] transition-all pixel-ease hover:brightness-110 hover:bg-accent hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_rgba(0,0,0,0.18)] active:translate-y-[3px] active:shadow-none"
        >
          Ask the tree
        </button>

        <p className="rounded-md border-[2px] border-gray-900 bg-white px-2.5 py-1 font-mono text-[10px] font-bold text-gray-800">
          {nextAt === undefined
            ? "knows all it can hold"
            : `next knowledge at ${nextAt} ft`}
        </p>

        {nextAt !== undefined && (
          <button
            type="button"
            onClick={() => setMenu(menu === "shop" ? null : "shop")}
            className="rounded border-[2px] border-gray-900 bg-[#d3f9d8] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-[#2b8a3e] transition-colors pixel-ease hover:bg-[#b2f2bb]"
          >
            Buy fertilizer {"\u2192"}
          </button>
        )}

        <button
          type="button"
          onClick={resetTreeProgress}
          title="Clears the tree's learned trivia and regrows it"
          className="rounded border-[2px] border-gray-900 bg-white px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-muted transition-colors pixel-ease hover:bg-accentSoft"
        >
          Reset progress
        </button>
      </div>

      <RetroDialog
        open={confirm !== null}
        title={confirm?.title ?? ""}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.onYes();
          setConfirm(null);
        }}
      >
        {confirm?.body}
      </RetroDialog>

      <RetroDialog
        open={notice !== null}
        title="Heads up"
        onCancel={() => setNotice(null)}
        onConfirm={() => setNotice(null)}
        confirmLabel="OK"
      >
        {notice}
      </RetroDialog>
    </div>
  );
}
