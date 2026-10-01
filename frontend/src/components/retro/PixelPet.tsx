import { useCallback, useEffect, useRef, useState } from "react";
import { useTypewriter } from "../../hooks/useTypewriter";
import {
  TIPS,
  EXTRA_TIPS,
  TIP_BY_ID,
  type Tip,
} from "../../data/tips";
import { HUNT_ITEMS } from "../../data/hunt";
import { ACHIEVEMENTS } from "../../data/achievements";
import { PET_FORMS, type PetVariant } from "../../data/petForms";
import { usePetForm } from "../../state/petForm";
import PetBlob from "./PetBlob";
import {
  getPetLines,
  getDestructionLine,
  getHungryLine,
} from "../../data/petlines";
import { removeFromLibrary } from "../../api";
import { answerQuestion } from "../../data/help";
import { useHunt, HUNT_FOUND_EVENT } from "../../state/hunt";
import { SLIME_ANIMATION_EVENT, type SlimeAnimationMode } from "../../utils/slimeEvents";
import {
  useAchievements,
  ACHIEVEMENT_UNLOCKED_EVENT,
} from "../../state/achievements";
import { ArrowDown, BlockCursor, CloseX, Diamond, Star } from "./PixelIcons";

/* ============================================================
   PIXEL PET — the resident arcade companion / clipper-style
   guide.

   Three ways to get tips:

   1. HOVER (the main way): hold your pointer on any element
      annotated with data-tips="<tip id>" for HOVER_DELAY_MS
      and the pet reveals that tip. A progress ring + percent
      chip on the pet shows the dwell charging up. After a tip
      is revealed the engine rests for HOVER_COOLDOWN_MS before
      it will dwell again, and a brief pointer excursion (under
      HOVER_GRACE_MS) does not reset the dwell.
   2. CLICK: the pet cycles through the tips you have already
      discovered — plus, while the scavenger hunt is running,
      a hint for the next missing treasure; once every treasure
      is found, the locked DEEP TIPS join the cycle too and
      EVERY tip is unlocked (the counter shows FOUND n/n).
   3. ASK (after the hunt): the pet becomes a help library —
      type a question and it answers from the full tip
      catalogue (see src/data/help.ts).

   The pet is also draggable: grab it and move it anywhere in the
   viewport (position persists in localStorage). The tooltip flips
   to the other side of the pet when it would leave the screen.
   Double-click opens a pet menu with quick actions, docking
   presets and the achievement rack.

   Discovered tips persist in localStorage (paperrec_tips_seen);
   treasures persist in paperrec_hunt_found.
   ============================================================ */

const HOVER_DELAY_MS = 5_000;
const HOVER_COOLDOWN_MS = 3_000;
const HOVER_GRACE_MS = 500;
const TICK_MS = 100;

const TIP_SPEED = 18;

const SEEN_KEY = "paperrec_tips_seen";
const PET_POS_KEY = "paperrec_pet_pos";

/* Every core tip. Finding all treasures unlocks all of them. */
const CORE_TIP_IDS = TIPS.map((tip) => tip.id);

const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/* Draggable pet: sizes used to clamp the pet inside the viewport
   and to flip the tooltip when it would leave the screen. */
const PET_SIZE = 64;
const PET_MARGIN = 20;
const DRAG_THRESHOLD = 6;
const TOOLTIP_W = 288;
const TOOLTIP_H = 320;
const TOOLTIP_GAP = 12;

/* Speech bubble: width cap, estimated height, gap to the pet. */
const BUBBLE_W = 220;
const BUBBLE_H = 44;
const BUBBLE_GAP = 10;

/* Ways the pet can dispose of a library paper dropped on it. */
const DESTRUCTION_MODES = ["zap", "eat", "crumple", "burn"] as const;
const DESTRUCTION_MS = 1_600;

/* Custom drag payload set by the My Library rows. */
const PAPER_DROP_MIME = "application/x-research-paper";

/* Double-click menu */
const MENU_W = 256;

/* Shown when the pet is clicked before any tip has been discovered. */
const INTRO: Tip = {
  id: "__intro__",
  title: "Re:Search Pet",
  body:
    "Hold your cursor on any part of the app and I will explain it. " +
    "Click me to replay the tips you have already found, and keep " +
    "an eye out: six hidden treasures are scattered across the " +
    "pages. Find them all and I become a full help library.",
};

const QUICK_QUESTIONS = ["PIPELINES?", "TF-IDF?", "IMPORT?", "BATTLE?"];

function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((value) => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    // best-effort
  }
}

interface PetPos {
  right: number;
  bottom: number;
}

function readPetPos(): PetPos {
  try {
    const raw = window.localStorage.getItem(PET_POS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (
      parsed &&
      typeof parsed.right === "number" &&
      typeof parsed.bottom === "number" &&
      Number.isFinite(parsed.right) &&
      Number.isFinite(parsed.bottom)
    ) {
      return clampPetPos({
        right: Math.max(0, parsed.right),
        bottom: Math.max(0, parsed.bottom),
      });
    }
  } catch {
    // best-effort
  }

  return { right: PET_MARGIN, bottom: PET_MARGIN };
}

function writePetPos(pos: PetPos) {
  try {
    window.localStorage.setItem(PET_POS_KEY, JSON.stringify(pos));
  } catch {
    // best-effort
  }
}

/** Keep the pet fully inside the viewport (right/bottom offsets). */
function clampPetPos(pos: PetPos): PetPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return {
    right: Math.max(0, Math.min(pos.right, Math.max(0, vw - PET_SIZE))),
    bottom: Math.max(0, Math.min(pos.bottom, Math.max(0, vh - PET_SIZE))),
  };
}

export default function PixelPet() {
  const [open, setOpen] = useState(false);
  const [currentTip, setCurrentTip] = useState<Tip | null>(null);

  const { form, setFormId } = usePetForm();

  const [seen, setSeen] = useState<string[]>(readSeen);

  /* Mirror of `seen` for stable callbacks (avoids re-creating
     reveal on every render, which would restart the hover engine). */
  const seenRef = useRef(seen);
  useEffect(() => {
    seenRef.current = seen;
  }, [seen]);

  const [hop, setHop] = useState(false);
  const [transformForm, setTransformForm] = useState<PetVariant | null>(null);
  const transformTimerRef = useRef<number | null>(null);
  const transformIntervalRef = useRef<number | null>(null);
  const [coins, setCoins] = useState<number[]>([]);
  const coinId = useRef(0);

  const [query, setQuery] = useState("");

  const { found, count, total, complete, reset } = useHunt();
  const { unlocked, updateProgress, bump, reset: resetAchievements } =
    useAchievements();

  /* --------------------------------------------------------
     Pet menu state (opens on double-click)
     -------------------------------------------------------- */

  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement | null>(null);

  function openMenu(event: React.MouseEvent) {
    event.preventDefault();
    setMenuPos({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - MENU_W - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight * 0.3)),
    });
  }

  function closeMenu() {
    setMenuPos(null);
  }

  /* --------------------------------------------------------
     Single click vs double click: a single click pets the pet
     after a short delay; if a second click arrives in time,
     the pending pet is cancelled and the menu opens instead.
     -------------------------------------------------------- */

  const clickTimerRef = useRef<number | null>(null);

  function handleClick() {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      return;
    }

    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      handlePet();
    }, 250);
  }

  function dock(corner: "tl" | "tr" | "bl" | "br") {
    const leftSide = corner === "tl" || corner === "bl";
    const topSide = corner === "tl" || corner === "tr";
    const pos = {
      right: leftSide
        ? Math.max(0, window.innerWidth - PET_SIZE - PET_MARGIN)
        : PET_MARGIN,
      bottom: topSide
        ? Math.max(0, window.innerHeight - PET_SIZE - PET_MARGIN)
        : PET_MARGIN,
    };
    setPetPos(pos);
    writePetPos(pos);
    closeMenu();
  }

  /* --------------------------------------------------------
     Drag to move: pointer capture on the pet, offsets from the
     viewport's right/bottom edges, clamped + persisted.
     -------------------------------------------------------- */

  const [petPos, setPetPos] = useState<PetPos>(readPetPos);
  const petPosRef = useRef(petPos);

  useEffect(() => {
    petPosRef.current = petPos;
  }, [petPos]);

  const [dragging, setDragging] = useState(false);
  const dragActiveRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
  } | null>(null);
  const lastDragEndRef = useRef(0);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRight: petPos.right,
      startBottom: petPos.bottom,
    };
    dragActiveRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

    if (!dragging) setDragging(true);

    setPetPos(
      clampPetPos({
        right: drag.startRight - dx,
        bottom: drag.startBottom - dy,
      }),
    );
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const moved =
      drag !== null &&
      event.pointerId === drag.pointerId &&
      Math.hypot(
        event.clientX - drag.startX,
        event.clientY - drag.startY,
      ) >= DRAG_THRESHOLD;

    dragRef.current = null;
    dragActiveRef.current = false;
    setDragging(false);

    if (moved) {
      // Swallow the click that follows a drag.
      lastDragEndRef.current = performance.now();
      writePetPos(petPosRef.current);
      bump("drags");
    }
  }

  function handlePointerCancel() {
    dragRef.current = null;
    dragActiveRef.current = false;
    setDragging(false);
  }

  // Re-clamp after window resizes so the pet never ends up
  // off-screen (e.g. the window shrank below the saved position).
  useEffect(() => {
    function handleResize() {
      setPetPos((current) => {
        const clamped = clampPetPos(current);
        return clamped.right === current.right &&
          clamped.bottom === current.bottom
          ? current
          : clamped;
      });
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* --------------------------------------------------------
     Hover dwell progress (HOVER_DELAY_MS of dwell reveals)
     -------------------------------------------------------- */

  const [hoverTipId, setHoverTipId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const body = currentTip ? currentTip.body : INTRO.body;
  const typed = useTypewriter(body, TIP_SPEED, open && !prefersReducedMotion);
  const shown = open ? (prefersReducedMotion ? body : typed) : "";
  const done = shown.length >= body.length;

  const seenSet = new Set(seen);

  /* --------------------------------------------------------
     Rewards: hop + "+1" coin
     -------------------------------------------------------- */

  const celebrate = useCallback(() => {
    setHop(true);
    window.setTimeout(() => setHop(false), 500);

    const id = coinId.current++;
    setCoins((current) => [...current, id]);
    window.setTimeout(
      () => setCoins((current) => current.filter((c) => c !== id)),
      1000,
    );
  }, []);

  /* While dragging, the pet hops along toward the pointer:
     re-trigger the hop animation every hop cycle. */
  const dragHopRef = useRef<number | null>(null);

  /* Shapeshift through every form for a moment, then return to the
     selected form. Runs when the pet eats a paper. */
  const startTransform = useCallback(() => {
    const all = PET_FORMS.map((f) => f.variant);
    let index = all.indexOf(form.variant);
    if (index === -1) index = 0;

    if (transformIntervalRef.current !== null) {
      window.clearInterval(transformIntervalRef.current);
    }
    if (transformTimerRef.current !== null) {
      window.clearTimeout(transformTimerRef.current);
    }

    transformIntervalRef.current = window.setInterval(() => {
      index = (index + 1) % all.length;
      setTransformForm(all[index]);
    }, 280);

    transformTimerRef.current = window.setTimeout(() => {
      if (transformIntervalRef.current !== null) {
        window.clearInterval(transformIntervalRef.current);
        transformIntervalRef.current = null;
      }
      setTransformForm(null);
    }, 1_700);
  }, [form.variant]);
  useEffect(() => {
    if (dragging) {
      setHop(true);
      dragHopRef.current = window.setInterval(() => {
        setHop(true);
        window.setTimeout(() => setHop(false), 450);
      }, 500);
    } else {
      if (dragHopRef.current !== null) {
        window.clearInterval(dragHopRef.current);
        dragHopRef.current = null;
      }
      setHop(false);
    }
    return () => {
      if (dragHopRef.current !== null) {
        window.clearInterval(dragHopRef.current);
        dragHopRef.current = null;
      }
    };
  }, [dragging]);

  /* --------------------------------------------------------
     Reveal a tip (from the hover engine)
     -------------------------------------------------------- */

  const reveal = useCallback(
    (id: string) => {
      const tip = TIP_BY_ID[id];
      if (!tip) return;

      setCurrentTip(tip);
      setOpen(true);

      if (!seenRef.current.includes(id)) {
        updateProgress({ seen: seenRef.current.length + 1 });
      }

      setSeen((previous) => {
        if (previous.includes(id)) return previous;
        const next = [...previous, id];
        writeSeen(next);
        return next;
      });

      celebrate();
    },
    [celebrate, updateProgress],
  );

  /* --------------------------------------------------------
     Hover engine: dwell on [data-tips] elements
     -------------------------------------------------------- */

  const lastRevealAtRef = useRef(0);

  useEffect(() => {
    let target: Element | null = null;
    let ticker: number | null = null;
    let startedAt = 0;
    let lastLeftAt = 0;

    function stop() {
      if (ticker !== null) {
        window.clearInterval(ticker);
        ticker = null;
      }
      target = null;
      lastLeftAt = 0;
      setProgress(0);
      setHoverTipId(null);
    }

    function start(element: Element, resume: boolean) {
      const id = element.getAttribute("data-tips");
      if (!id || !TIP_BY_ID[id]) return;

      // Post-reveal cooldown: the dwell clock starts when the
      // cooldown ends, so hovering during it simply waits — the
      // pointer does not need to leave and re-enter.
      const cooldownEnd = lastRevealAtRef.current + HOVER_COOLDOWN_MS;

      if (!resume) {
        startedAt = Math.max(Date.now(), cooldownEnd);
        setProgress(0);
      }

      target = element;
      setHoverTipId(id);

      if (ticker === null) {
        ticker = window.setInterval(() => {
          const ratio = Math.max(
            0,
            Math.min(1, (Date.now() - startedAt) / HOVER_DELAY_MS),
          );
          setProgress(ratio);

          if (ratio >= 1) {
            if (ticker !== null) {
              window.clearInterval(ticker);
              ticker = null;
            }
            const revealedId = target?.getAttribute("data-tips") ?? null;
            target = null;
            lastLeftAt = 0;
            lastRevealAtRef.current = Date.now();
            setHoverTipId(null);
            setProgress(0);
            if (revealedId) reveal(revealedId);
          }
        }, TICK_MS);
      }
    }

    function handleOver(event: PointerEvent) {
      if (dragActiveRef.current) return;

      const element = (event.target as Element | null)?.closest?.(
        "[data-tips]",
      );
      if (!element) return;

      const id = element.getAttribute("data-tips");
      if (!id || !TIP_BY_ID[id]) return;

      // Pointer came back to the same element inside the grace
      // window: resume the paused dwell instead of restarting it.
      if (element === target) {
        if (ticker === null && Date.now() - lastLeftAt < HOVER_GRACE_MS) {
          start(element, true);
        }
        return;
      }

      // Moved to a different tip element shortly after leaving the
      // previous one: keep the same dwell clock.
      if (target !== null && Date.now() - lastLeftAt < HOVER_GRACE_MS) {
        start(element, true);
        return;
      }

      stop();
      start(element, false);
    }

    function handleOut(event: PointerEvent) {
      if (!target) return;

      const related = event.relatedTarget as Node | null;

      // Still inside the target (moved between its children).
      if (related && target.contains(related)) return;

      // Pause the dwell; a return within the grace window resumes it.
      lastLeftAt = Date.now();
      if (ticker !== null) {
        window.clearInterval(ticker);
        ticker = null;
      }
    }

    window.addEventListener("pointerover", handleOver);
    window.addEventListener("pointerout", handleOut);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("blur", stop);

    return () => {
      stop();
      window.removeEventListener("pointerover", handleOver);
      window.removeEventListener("pointerout", handleOut);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("blur", stop);
    };
  }, [reveal]);

  /* --------------------------------------------------------
     Escape closes the tip box
     -------------------------------------------------------- */

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        closeMenu();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* --------------------------------------------------------
     Unlock every core tip (called when the hunt completes)
     -------------------------------------------------------- */

  const unlockAllTips = useCallback(() => {
    const missing = CORE_TIP_IDS.filter(
      (id) => !seenRef.current.includes(id),
    );
    if (missing.length === 0) return;

    const merged = [...seenRef.current, ...missing];
    writeSeen(merged);
    setSeen(merged);
    updateProgress({ seen: merged.length });
  }, [updateProgress]);

  /* --------------------------------------------------------
     Treasure found: celebrate + announce
     -------------------------------------------------------- */

  useEffect(() => {
    function handleFound(event: Event) {
      const id = (event as CustomEvent).detail?.id;
      const item = HUNT_ITEMS.find((candidate) => candidate.id === id);

      celebrate();

      if (!complete) {
        setCurrentTip({
          id: `found-${id ?? "unknown"}`,
          title: item ? item.name : "TREASURE FOUND",
          body:
            `Treasure collected: ${item?.name ?? "?"}! ` +
            `${Math.min(count + 1, total)}/${total}. ` +
            (count + 1 >= total
              ? "that was the last one. The help library is mine to give…"
              : "keep hunting. Click me for a hint."),
        });
      }

      // Last treasure: the pet unlocks its full capabilities —
      // every tip becomes discovered.
      if (count + 1 >= total) {
        unlockAllTips();
      }

      setOpen(true);
      updateProgress({
        treasures: Math.min(count + 1, total),
        treasureTotal: total,
        huntComplete: count + 1 >= total,
      });
    }

    window.addEventListener(HUNT_FOUND_EVENT, handleFound);
    return () => window.removeEventListener(HUNT_FOUND_EVENT, handleFound);
  }, [celebrate, count, total, complete, updateProgress, unlockAllTips]);

  /* --------------------------------------------------------
     Achievement unlocked: celebrate + announce
     -------------------------------------------------------- */

  useEffect(() => {
    function handleUnlock(event: Event) {
      const ids = (event as CustomEvent).detail?.ids as string[] | undefined;
      const first = Array.isArray(ids) ? ids[0] : undefined;
      const achievement = ACHIEVEMENTS.find(
        (candidate) => candidate.id === first,
      );

      celebrate();

      if (achievement) {
        setCurrentTip({
          id: `achievement-${achievement.id}`,
          title: "ACHIEVEMENT UNLOCKED",
          body: `"${achievement.name}": ${achievement.description}`,
        });
      }

      setOpen(true);
    }

    window.addEventListener(ACHIEVEMENT_UNLOCKED_EVENT, handleUnlock);
    return () =>
      window.removeEventListener(ACHIEVEMENT_UNLOCKED_EVENT, handleUnlock);
  }, [celebrate]);

  /* --------------------------------------------------------
     Pet menu: close on outside click / right-click
     -------------------------------------------------------- */

  useEffect(() => {
    if (!menuPos) return;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      closeMenu();
    }

    function handleContextMenu(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      closeMenu();
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [menuPos]);

  /* --------------------------------------------------------
     Click: open, then cycle through what's available
     -------------------------------------------------------- */

  function nextTreasureHint(): Tip | null {
    const missing = HUNT_ITEMS.find((item) => !found.includes(item.id));
    if (!missing) return null;

    return {
      id: `hint-${missing.id}`,
      title: "TREASURE HINT",
      body: `"${missing.name}" is hiding on the ${missing.page} page — ${missing.hint}.`,
    };
  }

  function nextDiscoveredTip(): Tip {
    const discovered = TIPS.filter((tip) => seenSet.has(tip.id));
    const hint = complete ? null : nextTreasureHint();

    const pool: Tip[] = [
      ...discovered,
      ...(complete ? EXTRA_TIPS : []),
      ...(hint ? [hint] : []),
    ];

    if (pool.length === 0) return INTRO;

    const index = currentTip
      ? pool.findIndex((tip) => tip.id === currentTip.id)
      : -1;

    return pool[(index + 1) % pool.length];
  }

  function handlePet() {
    // Swallow the click that immediately follows a drag.
    if (performance.now() - lastDragEndRef.current < 500) {
      lastDragEndRef.current = 0;
      return;
    }

    celebrate();
    bump("clicks");

    if (!open) {
      setCurrentTip(currentTip ?? nextDiscoveredTip());
      setOpen(true);
      return;
    }

    if (done) {
      setCurrentTip(nextDiscoveredTip());
    }
  }

  function handleClose() {
    setOpen(false);
  }

  /* --------------------------------------------------------
     Chat: answer a question from the help library
     -------------------------------------------------------- */

  function ask(raw: string) {
    const question = raw.trim();
    if (!question) return;

    const answer = answerQuestion(question);
    setCurrentTip({
      id: `ask-${question.slice(0, 40)}`,
      title: answer.title,
      body: answer.body,
    });
    setOpen(true);
    setQuery("");
    bump("asks");
  }

  function handleReset() {
    reset();
    resetAchievements();
    setSeen([]);
    writeSeen([]);
    setCurrentTip(null);
    setOpen(false);
  }

  const charging = hoverTipId !== null && progress > 0;

  /* --------------------------------------------------------
     Pet speech: short conversational lines float above the pet
     (replacing the plain treasure counter). The pet sometimes
     speaks Japanese characters and translates the line.
     -------------------------------------------------------- */

  const [speechIndex, setSpeechIndex] = useState(0);

  /* --------------------------------------------------------
     Paper drops: a library paper dragged onto the pet gets
     destroyed (zap / eat / crumple / burn, at random) and is
     deleted from the library. Pure visual flair.
     -------------------------------------------------------- */

  const [dropFx, setDropFx] = useState<{
    mode: (typeof DESTRUCTION_MODES)[number];
    title: string;
  } | null>(null);
  const [petHungry, setPetHungry] = useState(false);

  /* Event-driven reactions (search zap, upload eat, delete burn…). */
  const [petAnim, setPetAnim] = useState<SlimeAnimationMode | null>(null);
  const petAnimTimerRef = useRef<number | null>(null);

  const destructionTimerRef = useRef<number | null>(null);

  const speechLines = getPetLines(count, total, complete, form.variant);
  const speechLine = speechLines[speechIndex % speechLines.length];

  /* The bubble speaks the hungry line while a paper hovers over
     the pet, the destruction line while one is being disposed
     of or the pet reacts to an action, and the cycling line
     otherwise. */
  const activeSpeech = petHungry
    ? getHungryLine()
    : dropFx
      ? getDestructionLine(dropFx.mode)
      : petAnim
        ? getDestructionLine(petAnim)
        : speechLine;

  useEffect(() => {
    if (open || charging || dropFx) return;

    const id = window.setInterval(() => {
      setSpeechIndex((index) => index + 1);
    }, 6_000);

    return () => window.clearInterval(id);
  }, [open, charging, speechLines.length, dropFx]);

  function handleDragOver(event: React.DragEvent) {
    if (!event.dataTransfer.types.includes(PAPER_DROP_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setPetHungry(true);
  }

  function handleDragLeave() {
    setPetHungry(false);
  }

  async function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setPetHungry(false);

    const raw = event.dataTransfer.getData(PAPER_DROP_MIME);
    if (!raw) return;

    let paper: { id: number; title?: string } | null = null;
    try {
      paper = JSON.parse(raw);
    } catch {
      return;
    }
    if (!paper || typeof paper.id !== "number") return;

    const mode =
      DESTRUCTION_MODES[Math.floor(Math.random() * DESTRUCTION_MODES.length)];

    setDropFx({ mode, title: paper.title ?? `Paper #${paper.id}` });
    celebrate();

    /* Eating a paper makes the pet shapeshift through the forms,
       then return to the selected form (Rimuru-style transformation). */
    if (mode === "eat") {
      startTransform();
    }

    if (destructionTimerRef.current !== null) {
      window.clearTimeout(destructionTimerRef.current);
    }
    destructionTimerRef.current = window.setTimeout(() => {
      setDropFx(null);
    }, DESTRUCTION_MS);

    try {
      await removeFromLibrary(paper.id);
    } catch {
      // The show must go on even if the deletion fails — the
      // library row will simply reappear on the next load.
    }
  }

  useEffect(() => {
    return () => {
      if (destructionTimerRef.current !== null) {
        window.clearTimeout(destructionTimerRef.current);
      }
      if (transformIntervalRef.current !== null) {
        window.clearInterval(transformIntervalRef.current);
      }
      if (transformTimerRef.current !== null) {
        window.clearTimeout(transformTimerRef.current);
      }
    };
  }, []);

  /* --------------------------------------------------------
     Event-driven reactions: any action (search, upload, delete,
     battle) can dispatch SLIME_ANIMATION_EVENT and the pet plays
     the mode on itself with its speech line.
     -------------------------------------------------------- */

  useEffect(() => {
    function handleSlimeAnimation(event: Event) {
      const mode = (event as CustomEvent).detail?.mode as
        | SlimeAnimationMode
        | undefined;

      if (!mode) return;

      if (petAnimTimerRef.current !== null) {
        window.clearTimeout(petAnimTimerRef.current);
      }

      setPetAnim(mode);
      celebrate();

      petAnimTimerRef.current = window.setTimeout(() => {
        setPetAnim(null);
      }, 1_000);
    }

    window.addEventListener(SLIME_ANIMATION_EVENT, handleSlimeAnimation);
    return () => {
      window.removeEventListener(SLIME_ANIMATION_EVENT, handleSlimeAnimation);
      if (petAnimTimerRef.current !== null) {
        window.clearTimeout(petAnimTimerRef.current);
      }
    };
  }, [celebrate]);

  /* --------------------------------------------------------
     Tooltip flips to stay on screen next to a dragged pet:
     - flipX: not enough room to the left -> tooltip aligns
       to the pet's left edge instead of its right edge.
     - flipY: not enough room above -> tooltip drops below
       the pet (tail flips to point up).
     -------------------------------------------------------- */

  const flipX =
    open && petPos.right > window.innerWidth - TOOLTIP_W;
  const flipY =
    open &&
    petPos.bottom >
      window.innerHeight - PET_SIZE - TOOLTIP_GAP - TOOLTIP_H;

  /* Speech bubble flips the same way, against its own size:
     - speechFlipX: not enough room to the left of the pet ->
       the bubble aligns to the pet's left edge and grows right.
     - speechFlipY: not enough room above -> the bubble drops
       below the pet and its tail flips to point up. */
  const speechFlipX = petPos.right > window.innerWidth - BUBBLE_W;
  const speechFlipY =
    petPos.bottom >
    window.innerHeight - PET_SIZE - BUBBLE_GAP - BUBBLE_H;

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div
      className="fixed z-[9980]"
      style={{ right: petPos.right, bottom: petPos.bottom }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="relative h-16 w-16">
        {/* ----------------------------------------------------
            RPG-style tooltip box
            ---------------------------------------------------- */}

        {open && (
          <div
            className={`animate-step-in absolute z-30 max-h-80 w-72 max-w-[80vw] overflow-y-auto rounded border-[3px] border-gray-900 bg-gray-900 p-4 text-onInk ${
              flipY ? "top-full mt-3" : "bottom-full mb-3"
            } ${flipX ? "left-0" : "right-0"}`}
          >
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate font-mono text-xs font-bold tracking-[0.2em] text-accent">
              {(currentTip ? currentTip.title : INTRO.title)
                .toUpperCase()
                .slice(0, 26)}
            </p>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Close tip"
              className="rounded border-2 border-gray-700 px-1.5 py-0.5 font-mono text-xs font-bold text-onInk transition-colors pixel-ease hover:border-white hover:bg-white hover:text-gray-900"
            >
              <CloseX className="h-3 w-3" />
            </button>
          </div>

          <p className="min-h-16 font-mono text-xs leading-5 text-onInk">
            {shown}
            <BlockCursor className="animate-blink ml-0.5 inline-block h-[0.9em] w-[0.55em] text-accent" />
          </p>

          {done && (
            <p className="mt-2 flex items-center justify-between gap-2 text-right font-mono text-xs font-bold tracking-[0.2em] text-accent">
              <span>
                {complete
                  ? "HELP LIBRARY"
                  : `FOUND ${seen.length}/${TIPS.length}`}
              </span>
              <span className="animate-blink flex items-center gap-1.5">
                <ArrowDown className="h-2.5 w-2.5" />
                CLICK PET TO CONTINUE
              </span>
            </p>
          )}

          {/* Chat input — only after the hunt is complete */}
          {complete && (
            <div className="mt-2 border-t-2 border-gray-700 pt-2">
              <div className="mb-1.5 flex flex-wrap gap-1">
                {QUICK_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => ask(question)}
                    className="rounded border-2 border-gray-700 px-1.5 py-0.5 font-mono text-xs font-bold text-onInk transition-colors pixel-ease hover:border-accent hover:text-accent"
                  >
                    {question}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  ask(query);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ASK THE PET…"
                  aria-label="Ask the pet"
                  className="min-w-0 flex-1 rounded border-2 border-gray-700 bg-black/40 px-2 py-1 font-mono text-xs text-onInk placeholder:text-gray-500 focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!query.trim()}
                  className="rounded border-2 border-gray-700 px-2 py-1 font-mono text-xs font-bold text-onInk transition-colors pixel-ease hover:border-accent hover:bg-accent hover:text-gray-900 disabled:opacity-40"
                >
                  ASK
                </button>
              </form>

              <button
                type="button"
                onClick={handleReset}
                className="mt-1.5 font-mono text-xs font-bold tracking-[0.2em] text-gray-500 transition-colors pixel-ease hover:text-accent"
              >
                RESET PROGRESS
              </button>
            </div>
          )}

          {/* speech tail pointing at the pet */}
          <div
            className={`absolute h-4 w-4 rotate-45 border-gray-900 bg-gray-900 ${
              flipY
                ? "-top-[11px] border-t-[3px] border-l-[3px]"
                : "-bottom-[11px] border-b-[3px] border-r-[3px]"
            } ${flipX ? "left-9" : "right-9"}`}
            aria-hidden="true"
          />
        </div>
      )}

      {/* ----------------------------------------------------
          The pet itself (+ dwell charge + hunt progress)
          ---------------------------------------------------- */}

      {/* ----------------------------------------------------
          Pet speech bubble (short conversational line;
          pauses while a tip box or dwell ring is up)
          ---------------------------------------------------- */}

      {!open && !charging && (
          <div
            key={dropFx ? dropFx.mode : petAnim ?? speechIndex}
            className={`animate-pop-in absolute z-20 max-w-[min(220px,calc(100vw-40px))] rounded border-[3px] border-gray-900 bg-white px-2 py-1 font-mono text-xs leading-4 text-ink ${
              speechFlipY ? "top-full mt-2" : "bottom-full mb-2"
            } ${speechFlipX ? "left-0" : "right-0"}`}
          >
            {activeSpeech.jp && (
              <>
                <span className="font-bold text-accent">{activeSpeech.jp}</span>{" "}
              </>
            )}
            <span>{activeSpeech.en}</span>
            <span
              aria-hidden="true"
              className={`absolute h-3 w-3 rotate-45 border-gray-900 bg-white ${
                speechFlipY
                  ? "-top-[7px] border-t-[3px] border-l-[3px]"
                  : "-bottom-[7px] border-b-[3px] border-r-[3px]"
              } ${speechFlipX ? "left-5" : "right-5"}`}
            />
          </div>
        )}

        {/* ----------------------------------------------------
            Paper destruction FX — the dropped library paper as
            a chip that gets zapped / eaten / crumpled / burned.
            ---------------------------------------------------- */}

        {dropFx && (
          <div className="pointer-events-none absolute -top-10 left-1/2 z-30 -translate-x-1/2">
            <span
              className={`drop-fx-chip drop-fx-${dropFx.mode} block max-w-[200px] truncate rounded border-[3px] border-gray-900 bg-white px-2 py-1 font-mono text-xs font-bold text-ink`}
            >
              {dropFx.title}
            </span>
          </div>
        )}

        {charging && (
          <>
            <span className="absolute -top-7 right-0 z-20 whitespace-nowrap rounded border-[3px] border-gray-900 bg-white px-2 py-0.5 font-mono text-xs font-bold tracking-[0.15em] text-ink">
              TIP {Math.round(progress * 100)}%
            </span>

            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 -rotate-90"
            >
              <circle
                cx="50"
                cy="50"
                r={RING_RADIUS}
                className="fill-none stroke-gray-200"
                strokeWidth="5"
              />
              <circle
                cx="50"
                cy="50"
                r={RING_RADIUS}
                className="fill-none stroke-accent"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={
                  RING_CIRCUMFERENCE * (1 - Math.max(progress, 0.001))
                }
              />
            </svg>
          </>
        )}

        <div
          role="button"
          tabIndex={0}
          aria-label="Click the Re:Search pet for a tip (drag to move, double-click for menu)"
          onClick={handleClick}
          onDoubleClick={openMenu}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handlePet();
            }
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className={`group relative flex h-16 w-16 touch-none select-none items-end justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gray-900 ${
            dragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          {/* coins popped on petting / discovery */}
          {coins.map((id) => (
            <span
              key={id}
              aria-hidden="true"
              className="animate-coin-pop pointer-events-none absolute -top-1 right-1 z-30 font-mono text-xs font-bold text-accent"
            >
              +1
            </span>
          ))}

          {/* shadow */}
          <span
            aria-hidden="true"
            className="pet-shadow absolute bottom-1 h-3 w-10 rounded-full bg-gray-900/25"
          />

          {/* body — hungry (paper dragged over) opens wide; event
              animations (zap/eat/crumple/burn) play on the body */}
          <div className={`pet-bob relative z-10 ${hop ? "pet-hop" : ""}`}>
            <div className={petAnim ? `pet-anim-${petAnim}` : "pet-bounce"}>
              <div
                className={`flex h-12 w-12 items-center justify-center transition-transform duration-100 pixel-ease ${
                  petHungry
                    ? "scale-110 ring-2 ring-gray-900"
                    : dragging
                      ? ""
                      : "group-hover:scale-110 group-focus-visible:scale-110"
                }`}
              >
                <PetBlob
                  variant={transformForm ?? form.variant}
                  size={48}
                  hungry={petHungry}
                  className="drop-shadow-[1px_2px_0_rgba(0,0,0,0.15)]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------
          Right-click menu: quick actions + achievements
          ---------------------------------------------------- */}

      {menuPos && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 w-64 select-none rounded border-[3px] border-gray-900 bg-white p-2 font-mono text-xs text-ink"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <p className="px-2 pb-1.5 font-bold tracking-[0.25em] text-accent">
            PET MENU
          </p>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              handlePet();
              closeMenu();
            }}
            className="block w-full rounded border-2 border-gray-900 bg-surface px-2 py-1.5 text-left font-bold text-ink transition-colors pixel-ease hover:bg-accentSoft"
          >
            NEXT TIP
          </button>

          <div className="mt-2 border-t-2 border-gray-200 px-2 pt-1.5">
            <p className="flex items-center justify-between font-bold tracking-[0.15em] text-muted">
              <span>ACHIEVEMENTS</span>
              <span className="text-accent">
                {unlocked.length}/{ACHIEVEMENTS.length}
              </span>
            </p>
          </div>

          <div className="max-h-[40vh] overflow-y-auto py-1">
            {ACHIEVEMENTS.map((achievement) => {
              const got = unlocked.includes(achievement.id);

              return (
                <div
                  key={achievement.id}
                  className={`flex items-start gap-2 px-2 py-1.5 ${
                    got ? "" : "opacity-45"
                  }`}
                >
                  {got ? (
                    <Star className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                  ) : (
                    <Diamond className="mt-0.5 h-3 w-3 shrink-0 text-muted" />
                  )}
                  <div className="min-w-0">
                    <p
                      className={`font-bold leading-4 ${
                        got ? "text-ink" : "text-muted"
                      }`}
                    >
                      {achievement.name}
                    </p>
                    <p className="mt-0.5 text-xs leading-3.5 text-muted">
                      {achievement.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-1 border-t-2 border-gray-200 px-2 pt-1.5">
            <p className="mb-1 font-bold tracking-[0.15em] text-muted">
              DOCK
            </p>
            <div className="grid grid-cols-4 gap-1">
              {(["tl", "tr", "bl", "br"] as const).map((corner) => (
                <button
                  key={corner}
                  type="button"
                  role="menuitem"
                  onClick={() => dock(corner)}
                  className="rounded border-2 border-gray-900 bg-surface px-1 py-1 text-center font-mono text-xs font-bold text-ink transition-colors pixel-ease hover:bg-accentSoft"
                >
                  {corner.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-1 border-t-2 border-gray-200 px-2 pt-1.5">
            <p className="mb-1 flex items-center justify-between font-bold tracking-[0.15em] text-muted">
              <span>FORM</span>
              <span className="text-accent">{form.name}</span>
            </p>
            <div className="grid grid-cols-5 gap-1">
              {PET_FORMS.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  role="menuitem"
                  title={candidate.blurb}
                  aria-pressed={form.id === candidate.id}
                  onClick={() => setFormId(candidate.id)}
                  className={`flex h-10 items-center justify-center rounded border-2 border-gray-900 transition-colors pixel-ease ${
                    form.id === candidate.id
                      ? "bg-accentSoft"
                      : "bg-surface hover:bg-accentSoft"
                  }`}
                >
                  <PetBlob variant={candidate.variant} size={26} />
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              handleReset();
              closeMenu();
            }}
            className="mt-2 block w-full rounded border-2 border-gray-900 bg-surface px-2 py-1.5 text-left font-bold text-ink transition-colors pixel-ease hover:bg-accentSoft"
          >
            RESET PROGRESS
          </button>
        </div>
      )}
    </div>
  );
}