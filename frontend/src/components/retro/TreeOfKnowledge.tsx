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
import type { Trivia } from "../../data/trivia";
import { useHunt } from "../../state/hunt";
import { useAchievements } from "../../state/achievements";
import { readSeenTipCount, useSun } from "../../state/sun";
import { addOwnedSkin, SKINS_KEY, useOwnedSkins } from "../../state/skins";
import {
  TREE_GROWTH_TARGET,
  TREE_IDLE_LINES,
  TREE_SKIN_PRICES,
} from "../../data/knowledge";
import KnowledgeTree from "./KnowledgeTree";
import PixelGrowthTree from "./PixelGrowthTree";
import GardenBackdrop from "./GardenBackdrop";
import SunShop from "./SunShop";
import SparkleGlyph from "./SparkleGlyph";
import SunGlyph from "./SunGlyph";
import TokenGlyph from "./TokenGlyph";

const TRIVIA_KEY = "paperrec_knowledge_trivia";
const LEGACY_TRIVIA_KEY = "paperrec_wisdom_trivia";
const SPECIES_KEY = "paperrec_knowledge_species";
const ASKS_KEY = "paperrec_tree_asks";

const LAWN_COLS = 5;
const LAWN_ROWS = 4;

function readTriviaSeen(): string[] {
  try {
    const raw =
      window.localStorage.getItem(TRIVIA_KEY) ??
      window.localStorage.getItem(LEGACY_TRIVIA_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((value) => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function writeTriviaSeen(ids: string[]) {
  try {
    window.localStorage.setItem(TRIVIA_KEY, JSON.stringify(ids));
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
  } = useSun();

  const [seenTrivia, setSeenTrivia] = useState<string[]>(readTriviaSeen);
  /* Dropping a fertilizer pack feeds the tree; the outcome echoes
     in the speech bubble. */
  const [feedNote, setFeedNote] = useState<string | null>(null);
  /* The tree card's own menu: the shop, skins, and wallet panes. */
  const [menu, setMenu] = useState<"shop" | "skins" | "wallet" | null>(
    null,
  );
  const [dropActive, setDropActive] = useState(false);
  const dropDepthRef = useRef(0);
  const [speciesId, setSpeciesId] =
    useState<TreeSpeciesId>(readSpecies);
  const [current, setCurrent] = useState<Trivia | null>(null);
  const [tipsSeen] = useState<number>(readSeenTipCount);
  const ownedSkins = useOwnedSkins();

  /* The tree's growth: sun consumed by fertilizer, then extra sun
     zooms into the world tree. */
  /* Every fertilizer is one step on the original's growth
     timeline: 3,000 packets take the tree from seed to ancient,
     extra packets beyond that rise into the world tree. */
  const growth = Math.min(1, fertilizer / TREE_GROWTH_TARGET);

  const growthMarkers = SPECIES_GROWTH_MARKERS[speciesId];
  const activeMarker = [...growthMarkers]
    .reverse()
    .find((marker) => fertilizer >= marker.fert);
  function resetTreeProgress() {
    if (
      !window.confirm(
        "Reset the TREE completely — trivia, fertilizer, growth, " +
          "species, and skins? Sun and tokens stay; the tree " +
          "returns to the starter maple at its seed.",
      )
    ) {
      return;
    }

    try {
      window.localStorage.removeItem(TRIVIA_KEY);
      window.localStorage.removeItem(LEGACY_TRIVIA_KEY);
      window.localStorage.removeItem(ASKS_KEY);
      window.localStorage.removeItem(SPECIES_KEY);
      window.localStorage.removeItem(SKINS_KEY);
      window.localStorage.removeItem("paperrec_tree_size");
    } catch {
      // best-effort
    }

    setSeenTrivia([]);
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
    setSpeciesId(id);
    writeSpecies(id);
  }

  function buySkin(id: TreeSpeciesId) {
    const price = TREE_SKIN_PRICES[id];
    if (ownedSkins.includes(id)) return;

    if (
      !window.confirm(
        `Buy the ${treeSpecies(id).label} skin for ${price} growth tokens?`,
      )
    ) {
      return;
    }

    if (!spendTokens(price)) {
      window.alert(
        `Not enough growth tokens — ${price - tokens} more needed. ` +
          "Earn them by using the app: daily visits, battles, asks, " +
          "treasures, and achievements all pay tokens.",
      );
      return;
    }

    addOwnedSkin(id);
    setSpeciesId(id);
    writeSpecies(id);
    spawnSparkles(6);
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
    setSeenTrivia(nextSeen);
    writeTriviaSeen(nextSeen);
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
    <div className="overflow-hidden rounded border-[3px] border-gray-900 bg-white">
      {/* ---------------- menu bar: currency, menus, species ------ */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b-[3px] border-gray-900 bg-[#8a5a2b] px-3 py-2">
        <div className="flex items-center gap-1.5">
        <div
          className="flex items-center gap-1.5 rounded border-[3px] border-gray-900 bg-[#f5e08a] px-2 py-1 font-mono text-xs font-bold text-gray-900"
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
              : "bg-[#f5e08a] text-gray-900 hover:bg-[#fff3b8]"
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
              : "bg-[#f5e08a] text-gray-900 hover:bg-[#fff3b8]"
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
              : "bg-[#f5e08a] text-gray-900 hover:bg-[#fff3b8]"
          }`}
        >
          Wallet
        </button>
        </div>

        {/* the species bank */}
        <div className="flex flex-wrap items-center gap-1.5">

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
                title={`Plant a ${species.label}`}
                className={`flex w-16 flex-col items-center gap-0.5 rounded border-[3px] border-gray-900 px-1 py-1 transition-colors pixel-ease ${
                  planted
                    ? "bg-[#ffe9a8]"
                    : "bg-[#d9b382] hover:bg-[#e6c79c]"
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
              title={`Buy a ${species.label} skin for ${price} growth tokens (Sun Shop currency)`}
              className="flex w-16 flex-col items-center gap-0.5 rounded border-[3px] border-gray-900 bg-[#e0cfb8] px-1 py-1 transition-colors pixel-ease hover:bg-[#ecdcc4]"
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
              <span className="font-mono text-[8px] font-bold uppercase text-[#8a5a2b]">
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
      <div className="relative overflow-hidden px-3 pb-1.5 pt-6">
        {/* the completed landscape rests behind the tree */}
        <GardenBackdrop />

      <div className="relative z-10 flex flex-col items-center">
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
              growth={growth}
              onTreeClick={() => setBubbleClosed(false)}
            />

            {/* the bubble's tail points at the crown; it climbs as
                the tree grows and settles under the canopy. Closing
                it (x) hides it entirely — even the prompt — so the
                grown tree can be admired; ask or click the tree to
                call it back. */}
            {!bubbleClosed && (
            <div
              className="absolute left-1/2 z-10 w-max max-w-[260px] -translate-x-1/2 rounded border-[3px] border-gray-900 bg-white px-2.5 py-1.5 font-mono text-[11px] leading-4 text-ink shadow-[3px_3px_0_rgba(0,0,0,0.25)] transition-[bottom] duration-700 pixel-ease"
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

              {/* growth markers: the tree visibly grows at each sun value */}
              {!hideMarkers && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
                {growthMarkers.map((marker, index) => {
                  const reached = fertilizer >= marker.fert;
                  const active = activeMarker?.label === marker.label;
                  const nextFert =
                    growthMarkers[index + 1]?.fert ?? marker.fert;

                  return (
                    <span
                      key={marker.label}
                      className={`flex items-center gap-1 rounded-md border-[2px] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide shadow-[1px_1px_0_rgba(0,0,0,0.08)] ${
                        active
                          ? "border-gray-900 bg-[#f5e08a] text-gray-900"
                          : reached
                            ? "border-[#4a7a2f] bg-[#eef7e6] text-[#2b6e1e]"
                            : "border-gray-300/80 bg-white/85 text-gray-500"
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
                          {"\u00B7"} {nextFert - fertilizer}{" "}
                          fert
                        </span>
                      )}
                    </span>
                  );
                })}
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
      </div>

      {/* the tree's menu panels, inside its own card */}
      {menu && (
        <div className="border-t-[3px] border-gray-900">
          <div className="flex items-center justify-between gap-3 border-b-[3px] border-gray-900 bg-gradient-to-b from-[#96683a] to-[#82572c] px-3 py-2">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-[#ffe9a8]">
              {menu === "shop"
                ? "Sun shop"
                : menu === "skins"
                  ? "Tree skins"
                  : "Test wallet"}
            </p>
            <span className="flex items-center gap-2">
              {menu === "shop" && (
                <span
                  className="flex items-center gap-1.5 rounded border-[3px] border-gray-900 bg-[#f5e08a] px-2 py-1 font-mono text-xs font-bold text-gray-900"
                  title="Your sun tokens"
                >
                  <SunGlyph />
                  {balance}
                </span>
              )}
              {menu === "skins" && (
                <span
                  className="flex items-center gap-1.5 rounded border-[3px] border-gray-900 bg-[#f5e08a] px-2 py-1 font-mono text-xs font-bold text-gray-900"
                  title="Your growth tokens"
                >
                  <TokenGlyph />
                  {tokens}
                </span>
              )}
              <button
                type="button"
                onClick={() => setMenu(null)}
                aria-label="Close menu"
                title="Close this menu"
                className="grid h-5 w-5 place-items-center rounded border-[2px] border-[#ffe9a8]/80 font-mono text-[11px] font-bold leading-none text-[#ffe9a8] transition-colors pixel-ease hover:bg-[#ffe9a8]/15"
              >
                {"\u00D7"}
              </button>
            </span>
          </div>
          <div className="bg-[#fbf7ee]">
            <SunShop embedded tab={menu} hidePreview />
          </div>
        </div>
      )}

      {/* centered action row under the bed */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 border-t-[3px] border-gray-900 bg-[#eef7e6] px-4 py-3">
        <button
          type="button"
          onClick={askTree}
          className="rounded-lg border-[3px] border-gray-900 bg-[#e8b04b] px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.1em] text-gray-900 shadow-[3px_3px_0_rgba(0,0,0,0.18)] transition-all pixel-ease hover:bg-[#f0c161] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_rgba(0,0,0,0.18)] active:translate-y-[3px] active:shadow-none"
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
    </div>
  );
}
