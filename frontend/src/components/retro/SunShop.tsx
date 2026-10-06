/* ============================================================
   SUN SHOP — the Lab's third tab.

   A Plants-vs-Zombies-style storefront: sun tokens on the left
   (your tree's current stage and growth breakdown) and the
   fertilizer item on the right, sold in packs of 1, 5, or 10
   with bulk discounts. Every packet adds growth points to the
   Tree of Knowledge, so the earnings loop feeds the tree.

   Earning runs through state/sun.tsx: the daily visit bonus,
   petting the companion, asking the help library, and one-time
   bounties for treasures, achievements, and tip milestones.
   ============================================================ */

import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  KNOWLEDGE_STAGES,
  knowledgePoints,
  knowledgeStageFromHeight,
  nextKnowledgeHeight,
  TREE_SKIN_PRICES,
  treeSpecies,
  type TreeSpeciesId,
} from "../../data/knowledge";
import {
  ACHIEVEMENT_BOUNTY,
  ASK_SUN_CAP,
  DAILY_BONUS,
  FEET_PER_FERTILIZER,
  GROWTH_PER_FERTILIZER,
  PETS_PER_SUN,
  PET_SUN_CAP,
  readSeenTipCount,
  TIP_BOUNTY,
  TIPS_PER_BOUNTY,
  TREASURE_BOUNTY,
  useSun,
} from "../../state/sun";
import { useHunt } from "../../state/hunt";
import { useAchievements } from "../../state/achievements";
import { addOwnedSkin, useOwnedSkins } from "../../state/skins";
import { CHEAT_HEIGHTS } from "../../data/knowledge";
import KnowledgeTree from "./KnowledgeTree";
import SparkleGlyph from "./SparkleGlyph";
import SunGlyph from "./SunGlyph";
import TokenGlyph from "./TokenGlyph";

const RAIL_TABS: {
  id: "shop" | "skins" | "wallet";
  label: string;
  glyph: JSX.Element;
}[] = [
  { id: "shop", label: "Sun shop", glyph: <SunGlyph className="h-3 w-3" /> },
  { id: "skins", label: "Tree skins", glyph: <TokenGlyph className="h-3 w-3" /> },
  { id: "wallet", label: "Wallet", glyph: <TokenGlyph className="h-3 w-3" /> },
];

const TREE_SPECIES_CARDS: {
  id: TreeSpeciesId;
  label: string;
}[] = [
  { id: "crimson", label: "Crimson maple" },
  { id: "oak", label: "Oak" },
  { id: "birch", label: "Birch" },
  { id: "elm", label: "Elm" },
  { id: "redwood", label: "Redwood" },
];

const SPECIES_KEY = "paperrec_knowledge_species";

function readSpecies(): TreeSpeciesId {
  try {
    const raw = window.localStorage.getItem(SPECIES_KEY);
    if (raw && ["crimson", "oak", "birch", "elm", "redwood"].includes(raw)) {
      return raw as TreeSpeciesId;
    }
  } catch {
    // best-effort
  }
  return "oak";
}



function FertilizerIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-12 w-12 shrink-0" aria-hidden="true">
      <rect
        x="7"
        y="10"
        width="18"
        height="18"
        rx="2"
        fill="#a9762f"
        stroke="#5a3a14"
        strokeWidth="2"
      />
      <rect
        x="10"
        y="4"
        width="12"
        height="8"
        rx="2"
        fill="#8a5a2b"
        stroke="#5a3a14"
        strokeWidth="2"
      />
      <path
        d="M16 14 l4 5 h-3 v5 h-2 v-5 h-3 z"
        fill="#7ec850"
        stroke="#3b6d11"
        strokeWidth="1"
      />
    </svg>
  );
}

export default function SunShop({
  hidePreview = false,
  embedded = false,
  tab,
}: {
  /** Hide the "Your tree" preview when the real tree sits beside it. */
  hidePreview?: boolean;
  /** Embedded in the tree card: no frame, no triggers — the tree's
      own menu chips drive `tab`. */
  embedded?: boolean;
  tab?: "shop" | "skins" | "wallet";
}) {
  const {
    balance,
    fertilizer,
    bonusGrowth,
    height,
    nextMilestone,
    cheats,
    activeCheats,
    buy,
    redeemCheat,
    tokens,
    spendTokens,
    testTopUp,
    cheatSet,
  } = useSun();
  const { count: treasures } = useHunt();
  const { unlocked } = useAchievements();

  const [tips] = useState<number>(readSeenTipCount);
  const [species] = useState<TreeSpeciesId>(readSpecies);
  const ownedSkins = useOwnedSkins();
  const [cheatWord, setCheatWord] = useState("");
  const [message, setMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  /* Greenhouse panes: one open at a time, inside the rail. */
  const [popupState, setPopup] = useState<"shop" | "skins" | "wallet">(
    "shop",
  );
  const popup = embedded && tab ? tab : popupState;
  const railRef = useRef<HTMLDivElement | null>(null);




  /* Sparkle burst on a successful planting. */
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
      x: Math.round(Math.random() * 60 - 30),
      y: Math.round(Math.random() * 26 - 13),
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

  function handleBuy(count: 1 | 5 | 10) {
    const result = buy(count);
    setMessage(result);
    if (result.ok) spawnSparkles(6);
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
    spawnSparkles(6);
  }

  useEffect(() => {
    if (!message) return;

    const id = window.setTimeout(() => setMessage(null), 3200);
    return () => window.clearTimeout(id);
  }, [message]);

  const basePoints = knowledgePoints({
    treasures,
    achievements: unlocked.length,
    tips,
  });
  const total = basePoints + bonusGrowth;
  /* Knowledge tiers ride on the tree's height: it only knows as
     deep as it has grown. */
  const stage = knowledgeStageFromHeight(height);
  const nextAt = nextKnowledgeHeight(height);
  const tree = treeSpecies(species);

  const packs = [
    { count: 1 as const, price: 20, discount: null },
    { count: 5 as const, price: 90, discount: "save 10%" },
    { count: 10 as const, price: 160, discount: "save 20%" },
  ];

  return (
    <div className={embedded ? "w-full" : "grid gap-6 lg:grid-cols-2"}>
      <div
        ref={railRef}
        className={`relative flex w-full min-h-0 flex-col overflow-hidden ${
          embedded
            ? ""
            : "rounded border-[3px] border-gray-900 bg-white lg:h-[var(--garden-h,auto)]"
        }`}
      >
      {!hidePreview && (
        <section className="rounded border-[3px] border-gray-900 bg-white p-4">
        <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
          Your tree
        </p>

        <div className="flex items-center gap-4">
          <div className="relative">
            <KnowledgeTree
              stage={stage}
              species={species}
              size={104}
              heightFt={height}
            />

            <span
              aria-hidden="true"
              className="absolute -bottom-1 left-1/2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-black/20"
            />

            {sparkles.map((sparkle) => (
              <span
                key={sparkle.id}
                aria-hidden="true"
                className="sparkle-pop pointer-events-none absolute top-6 z-10"
                style={{
                  left: `calc(50% + ${sparkle.x}px)`,
                  marginTop: sparkle.y,
                }}
              >
                <SparkleGlyph />
              </span>
            ))}
          </div>

          <div className="min-w-0">
            <p className="font-mono text-sm font-bold text-ink">
              {tree.label}
              {" · "}
              {KNOWLEDGE_STAGES[stage]}
            </p>

            <p className="mt-1 text-xs leading-5 text-muted">
              Growth {total} = {basePoints} earned + {bonusGrowth}{" "}
              fertilized — the tree's knowledge rides on its height.
            </p>

            <p className="mt-1 text-xs leading-5 text-muted">
              {nextAt === undefined
                ? "Fully grown — the tree knows everything it can hold."
                : `Next knowledge at ${nextAt} ft.`}
            </p>

            <p className="mt-1 text-xs leading-5 text-muted">
              Height {height} ft
              {nextMilestone
                ? ` · next wisdom at ${nextMilestone.height} ft`
                : " · every wisdom has bloomed"}
            </p>

            <p className="mt-1 text-xs leading-5 text-muted">
              {fertilizer} fertilizer
              {fertilizer === 1 ? "" : "s"} planted
            </p>
          </div>
        </div>
      </section>
      )}

      {/* ---------------- rail triggers: the card's header row ----- */}
      {!embedded && (
      <div
        role="group"
        aria-label="Garden shop"
        className="grid w-full grid-cols-3 border-b-[3px] border-gray-900 bg-[#8a5a2b]"
      >
        {RAIL_TABS.map((entry, index) => {
          const active = popup === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              aria-expanded={active}
              onClick={() => setPopup(entry.id)}
              className={`flex min-w-0 items-center justify-center gap-1.5 px-2 py-2.5 font-mono text-[10px] font-bold uppercase tracking-wide transition-colors pixel-ease ${
                index < RAIL_TABS.length - 1
                  ? "border-r-[3px] border-gray-900"
                  : ""
              } ${
                active
                  ? "bg-[#f5e08a] text-gray-900"
                  : "text-[#ffe9a8] hover:bg-white/10"
              }`}
            >
              {entry.glyph}
              {entry.label}
            </button>
          );
        })}
      </div>
      )}

      {/* ---------------- greenhouse panes, inside the card -------- */}
      <div
        data-shop-panel
        className="min-h-0 w-full flex-1 overflow-y-auto"
        style={embedded ? { maxHeight: 420 } : undefined}
        role="group"
          aria-label={
            popup === "shop"
              ? "Sun shop"
              : popup === "skins"
                ? "Tree skins"
                : "Test wallet"
          }
        >
          <div className="p-4">
            {popup === "shop" && (
              <>
<div className="rounded border-[3px] border-gray-900 bg-[#d9b382] p-3">
          <div className="flex items-start gap-3">
            <FertilizerIcon />

            <div className="min-w-0">
              <p className="font-mono text-sm font-bold text-gray-900">
                Fertilizer
              </p>
              <p className="mt-0.5 text-xs leading-5 text-gray-800">
                Feeds the Tree of Knowledge: each packet adds{" "}
                {GROWTH_PER_FERTILIZER} growth points. Height follows
                the tree's stage — from seed at 0 ft to the ancient
                tree at 1000 ft across all 10,000 packets — and
                feeding dispenses wisdom: a cheat word at 100, 500,
                and 1000 feet, a garden tip otherwise.
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {packs.map((pack) => {
              const affordable = balance >= pack.price;

              return (
                <button
                  key={pack.count}
                  type="button"
                  disabled={!affordable}
                  onClick={() => handleBuy(pack.count)}
                  draggable={affordable}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "application/x-fertilizer",
                      String(pack.count),
                    );
                    event.dataTransfer.effectAllowed = "copy";

                    /* The drag ghost is the fertilizer icon itself,
                       badge-styled, with the pack count on it. */
                    const svgNS = "http://www.w3.org/2000/svg";
                    const icon = document.createElementNS(svgNS, "svg");
                    icon.setAttribute("viewBox", "0 0 32 32");
                    icon.setAttribute("width", "40");
                    icon.setAttribute("height", "40");
                    icon.setAttribute("aria-hidden", "true");
                    icon.style.display = "block";
                    icon.innerHTML =
                      '<rect x="7" y="10" width="18" height="18" rx="2" fill="#a9762f" stroke="#5a3a14" stroke-width="2"></rect>' +
                      '<rect x="10" y="4" width="12" height="8" rx="2" fill="#8a5a2b" stroke="#5a3a14" stroke-width="2"></rect>' +
                      '<path d="M16 14 l4 5 h-3 v5 h-2 v-5 h-3 z" fill="#7ec850" stroke="#3b6d11" stroke-width="1"></path>';

                    const ghost = document.createElement("div");
                    ghost.style.cssText =
                      "position:fixed;left:0;top:0;display:grid;place-items:center;" +
                      "gap:2px;width:56px;height:56px;border:3px solid #1a1a1a;" +
                      "border-radius:10px;background:#d9b382;box-shadow:3px 3px 0 rgba(0,0,0,0.35);";
                    ghost.appendChild(icon);
                    const badge = document.createElement("span");
                    badge.textContent = `${pack.count}x`;
                    badge.style.cssText =
                      "font:700 11px ui-monospace,monospace;color:#3b6d11;background:#f5e08a;" +
                      "border:2px solid #1a1a1a;border-radius:4px;padding:0 4px;";
                    ghost.appendChild(badge);
                    document.body.appendChild(ghost);
                    event.dataTransfer.setDragImage(ghost, 28, 28);
                    window.setTimeout(() => ghost.remove(), 0);
                  }}
                  title={
                    affordable
                      ? `Buy or drag ${pack.count} fertilizer onto the tree for ${pack.price} sun`
                      : `Needs ${pack.price} sun`
                  }
                  className={`flex flex-col items-center gap-0.5 rounded border-[3px] border-gray-900 px-1 py-2 font-mono text-[11px] font-bold transition-colors pixel-ease ${
                    affordable
                      ? "bg-[#e8b04b] text-gray-900 hover:bg-[#f0c161] active:translate-y-[1px]"
                      : "cursor-not-allowed bg-[#cbb894] text-gray-600"
                  }`}
                >
                  <span>{pack.count}×</span>
                  <span className="flex items-center gap-1">
                    <SunGlyph className="h-3 w-3" />
                    {pack.price}
                  </span>
                  <span className="text-[9px] font-bold uppercase text-[#3b6d11]">
                    {pack.discount ?? "\u00a0"}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-right font-mono text-[9px] font-bold uppercase tracking-wider text-[#6a4a20]/80">
            drag a pack onto the tree to feed it
          </p>

          {message && (
            <p
              role="status"
              className={`mt-2 rounded border-[2px] border-gray-900 px-2 py-1 font-mono text-[11px] font-bold ${
                message.ok
                  ? "bg-[#d3f9d8] text-[#2b8a3e]"
                  : "bg-[#ffe3e3] text-[#c92a2a]"
              }`}
            >
              {message.text}
            </p>
          )}
        </div>

        <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
          How to earn sun
        </p>
        <ul className="mt-1 space-y-0.5 text-xs leading-5 text-muted">
          <li>Daily visit: +{DAILY_BONUS}</li>
          <li>
            Every {PETS_PER_SUN} pets: +1 (max {PET_SUN_CAP}/day)
          </li>
          <li>
            Every help question: +1 (max {ASK_SUN_CAP}/day)
          </li>
          <li>Each treasure: +{TREASURE_BOUNTY}</li>
          <li>Each achievement: +{ACHIEVEMENT_BOUNTY}</li>
          <li>
            Every {TIPS_PER_BOUNTY} tips discovered: +{TIP_BOUNTY}
          </li>
        </ul>

        <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
          Cheat words
        </p>

        {cheatSet.length === 0 ? (
          <p className="mt-1 text-xs leading-5 text-muted">
            The tree keeps its cheats until it grows taller.
          </p>
        ) : (
          <ul className="mt-1 space-y-1">
            {cheatSet.map((entry, index) => {
              const unlocked = cheats.includes(entry.word);
              const armed = activeCheats.includes(entry.word);
              return (
                <li key={entry.word} className="flex items-start gap-2">
                  <span className={`shrink-0 rounded border-[2px] border-gray-900 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase transition-colors pixel-ease ${
                    unlocked
                      ? "bg-[#d3f9d8] text-[#2b8a3e]"
                      : "bg-white/60 text-gray-400"
                  }`}>
                    {entry.word}
                    {armed
                      ? " \u2713"
                      : unlocked
                        ? ""
                        : ` (${CHEAT_HEIGHTS[index]} ft)`}
                  </span>
                  <span className="text-xs leading-5 text-muted">
                    {entry.effect}
                  </span>
                  {unlocked && (
                    <button
                      type="button"
                      onClick={() => setMessage(redeemCheat(entry.word))}
                      title={armed ? "Disarm this cheat" : "Arm this cheat"}
                      className="ml-auto shrink-0 rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase transition-colors pixel-ease hover:bg-accentSoft"
                    >
                      {armed ? "on" : "arm"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            setMessage(redeemCheat(cheatWord));
            setCheatWord("");
          }}
          className="mt-2 flex gap-1.5"
        >
          <input
            value={cheatWord}
            onChange={(event) => setCheatWord(event.target.value)}
            placeholder="type a cheat word…"
            aria-label="Cheat word"
            className="min-h-7 min-w-0 flex-1 rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 font-mono text-[11px] text-ink placeholder:text-muted"
          />
          <button
            type="submit"
            className="rounded border-[2px] border-gray-900 bg-[#e8b04b] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-gray-900 transition-colors pixel-ease hover:bg-[#f0c161]"
          >
            Cast
          </button>
        </form>
              </>
            )}
            {popup === "skins" && (
              <>
        <p className="mb-1 text-xs leading-5 text-muted">
          Maple is your free starter tree. Every other species is a skin
          you keep for good — buy them here or from the tree panel's
          seed bank.
        </p>
        <p className="mb-3 text-xs leading-5 text-muted">
          Growth tokens pay for skins and come from using the app:{" "}
          <strong className="text-ink">+3</strong> on a new day,{" "}
          <strong className="text-ink">+1</strong> per finished battle
          (3/day), <strong className="text-ink">+1</strong> per 5 tree
          asks (3/day), and <strong className="text-ink">+1</strong>{" "}
          apiece for treasures and achievements. Keep using the app and
          every skin will come home.
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          {TREE_SPECIES_CARDS.map((entry) => {
            const owned = ownedSkins.includes(entry.id);
            const price = TREE_SKIN_PRICES[entry.id];

            return (
              <div
                key={entry.id}
                className={`flex flex-col items-center gap-1.5 rounded-lg border-[3px] p-2.5 transition-all duration-150 pixel-ease ${
                  owned
                    ? "border-[#2b8a3e] bg-[#eef7e6]"
                    : "border-gray-900 bg-gradient-to-b from-[#e2c091] to-[#d3a971] hover:-translate-y-[1px] hover:shadow-[2px_2px_0_rgba(0,0,0,0.15)]"
                }`}
              >
                <KnowledgeTree
                  stage={stage}
                  species={entry.id}
                  size={44}
                />
                <span className="font-mono text-[10px] font-bold uppercase text-gray-900">
                  {entry.label}
                </span>

                {owned ? (
                  <span className="rounded border-[2px] border-[#2b8a3e] bg-white px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-[#2b8a3e]">
                    Owned
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => buySkin(entry.id)}
                    disabled={tokens < price}
                    title={
                      tokens >= price
                        ? `Buy for ${price} growth tokens`
                        : `Needs ${price - tokens} more growth tokens`
                    }
                    className={`flex items-center gap-1 rounded border-[3px] border-gray-900 px-2 py-0.5 font-mono text-[9px] font-bold uppercase transition-colors pixel-ease ${
                      tokens >= price
                        ? "bg-[#e8b04b] text-gray-900 hover:bg-[#f0c161] active:translate-y-[1px]"
                        : "cursor-not-allowed bg-[#cbb894] text-gray-600"
                    }`}
                  >
                    <TokenGlyph className="h-2.5 w-2.5" />
                    {price}
                  </button>
                )}
              </div>
            );
          })}
        </div>
              </>
            )}
            {popup === "wallet" && (
              <>
        <section className="rounded-xl border-[2px] border-dashed border-[#b45309]/55 bg-[#fff7e6] p-3.5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#b45309]">
            Test wallet (temporary)
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Dev only: top up instantly to stress the shop and the Tree
            of Knowledge. Remove before launch.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => testTopUp(1000, 0)}
              className="flex w-full items-center justify-between rounded border-[3px] border-[#b45309] bg-white px-3 py-1.5 font-mono text-[11px] font-bold text-[#b45309] transition-colors pixel-ease hover:bg-[#fde68a]"
            >
              <span>+1,000 sun</span>
            <SunGlyph className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => testTopUp(0, 1000)}
              className="flex w-full items-center justify-between rounded border-[3px] border-[#b45309] bg-white px-3 py-1.5 font-mono text-[11px] font-bold text-[#b45309] transition-colors pixel-ease hover:bg-[#fde68a]"
            >
              <span>+1,000 growth tokens</span>
            <TokenGlyph className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => testTopUp(1000, 1000)}
              className="flex w-full items-center justify-between rounded border-[3px] border-[#b45309] bg-white px-3 py-1.5 font-mono text-[11px] font-bold text-[#b45309] transition-colors pixel-ease hover:bg-[#fde68a]"
            >
              <span>both</span>
            <span className="flex items-center gap-1">
              <SunGlyph className="h-3 w-3" />
              <TokenGlyph className="h-3 w-3" />
            </span>
            </button>
          </div>
        </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
