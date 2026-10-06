/* ============================================================
   CHEAT FOLIAGE — the garden's cheat décor leaks into the web
   design. When one of the tree's cheat foliage is active, pixel
   sprites puff off the planted tree and drift over the pages of
   the app, sticking to buttons and cards before fading out.

   Confined to the web app's bounding box (#app-shell) — it can
   only interfere with the app itself, never beyond it.
   ============================================================ */

import { useEffect, useRef, useState } from "react";

const SUN_KEY = "paperrec_sun";

/* Cheat id -> foliage palette + sprite mix. Fallbacks use the
   planted tree's own leaf tones. */
const FOLIAGE_BY_CHEAT: Record<string, { colors: string[]; shapes: string[] }> = {
  syrup: { colors: ["#e8a33d", "#b8772a", "#ffe9a8"], shapes: ["droplet", "round"] },
  blaze: { colors: ["#ff6b35", "#c9351c", "#ffb03a"], shapes: ["ember", "speck"] },
  amber: { colors: ["#ffb03a", "#ffe9a8", "#d97a1f"], shapes: ["petal", "droplet"] },
  daisies: { colors: ["#ffffff", "#ffe9a8", "#f5e08a"], shapes: ["petal", "round"] },
  dance: { colors: ["#8a5a2b", "#6a4a20", "#c98a4b"], shapes: ["cone", "round"] },
  pinata: { colors: ["#e83c8f", "#2b8a3e", "#e8b04b", "#4a7ad9"], shapes: ["speck", "round"] },
  paper: { colors: ["#f5f0e2", "#d8d2c2", "#a8a492"], shapes: ["flake", "speck"] },
  silver: { colors: ["#c9d3e0", "#eaf0f8", "#98a7b8"], shapes: ["ember", "speck"] },
  ribbon: { colors: ["#d94f8e", "#c9351c", "#e89bb8"], shapes: ["flag", "droplet"] },
  vase: { colors: ["#ffdf8f", "#e8b04b", "#fff3cf"], shapes: ["round", "speck"] },
  ridge: { colors: ["#6a4a20", "#8a5a2b", "#4a3a18"], shapes: ["cone", "flake"] },
  shade: { colors: ["#3f5a3f", "#7a9b6a", "#5a7a4f"], shapes: ["petal", "leaf"] },
  grove: { colors: ["#4a7a3d", "#2b5a24", "#6a9a54"], shapes: ["needle", "cone"] },
  mist: { colors: ["#dce6ef", "#eef4fa", "#c3d2de"], shapes: ["round", "flare"] },
  elder: { colors: ["#2b8a3e", "#1f6a2e", "#5ab86a"], shapes: ["leaf", "round"] },
};

const SHAPES: Record<string, number[][]> = {
  droplet: [[0, 0, 1, 0, 1, 1, 0, 2]],
  round: [[0, 0, 1, 0, 1, 1, 0, 1]],
  petal: [[0, 0, 1, 0, 2, 1, 1, 2]],
  ember: [[0, 0, 1, 0, 0, 1]],
  speck: [[0, 0]],
  cone: [[0, 0, 1, 1, 0, 2]],
  flake: [[0, 0, 2, 0, 1, 1, 1, 2]],
  flag: [[0, 2, 1, 1, 2, 0, 1, 2]],
  leaf: [[0, 1, 1, 0, 2, 1, 1, 2]],
  needle: [[0, 0, 1, 1, 2, 2]],
  flare: [[1, 0, 0, 1, 2, 1, 1, 2]],
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  shape: number[][];
  size: number;
  life: number;
  ttl: number;
  wob: number;
  stuck: { x: number; y: number } | null;
  alpha: number;
}

function appBox() {
  const app = document.getElementById("app-shell");
  if (app) {
    const rect = app.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

function readFoligeFlavour(): string[] {
  try {
    const raw = window.localStorage.getItem(SUN_KEY);
    if (!raw) return [];
    const state = JSON.parse(raw);
    const cheats = Array.isArray(state?.activeCheats) ? state.activeCheats : [];
    return cheats.filter((id: unknown) => typeof id === "string");
  } catch {
    return [];
  }
}

export default function CheatFoliage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState<string[]>(readFoligeFlavour);

  useEffect(() => {
    const sync = () => setActive(readFoligeFlavour());
    window.addEventListener("storage", sync);
    const timer = window.setInterval(sync, 1200);
    return () => {
      window.removeEventListener("storage", sync);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (active.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const particles: Particle[] = [];
    let running = true;
    let accumulator = 0;
    let last = performance.now();

    const palette =
      FOLIAGE_BY_CHEAT[active[0]]?.colors ??
      ["#d9b382", "#8a5a2b", "#b8772a"];
    const shapeNames = FOLIAGE_BY_CHEAT[active[0]]?.shapes ?? ["round"];

    const draw = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        if (p.alpha <= 0) continue;
        context.globalAlpha = p.alpha;
        context.fillStyle = p.color;
        for (const cell of p.shape) {
          context.fillRect(
            (p.x + cell[0] * p.size) | 0,
            (p.y + cell[1] * p.size) | 0,
            p.size,
            p.size,
          );
        }
      }
      context.globalAlpha = 1;
    };

    const step = () => {
      if (!running) return;
      const now = performance.now();
      const elapsed = Math.min(0.05, (now - last) / 1000);
      last = now;
      const box = appBox();

      /* Spawn a pinch from the planted tree's card. */
      const tree = document.querySelector("[data-tree-card]");
      const source = tree?.getBoundingClientRect() ?? {
        left: box.left + box.width * 0.4,
        top: box.top + box.height * 0.55,
        width: 0,
        height: 0,
      };

      const rate = active.length > 0 ? 11 : 0;
      accumulator += elapsed * rate;
      while (accumulator >= 1) {
        accumulator -= 1;
        if (particles.length >= 80) break;
        const shapeKey = shapeNames[Math.floor(Math.random() * shapeNames.length)];
        const shape = SHAPES[shapeKey] ?? SHAPES.round;
        const sx = source.left + Math.random() * Math.max(40, source.width * 0.35);
        const sy = source.top + Math.random() * 24 + 4;
        particles.push({
          x: sx,
          y: sy,
          vx: (Math.random() - 0.25) * 26,
          vy: -(18 + Math.random() * 46),
          color: palette[Math.floor(Math.random() * palette.length)],
          shape,
          size: Math.random() < 0.3 ? 1 : 2,
          life: 0,
          ttl: 5 + Math.random() * 9,
          wob: 2 + Math.random() * 3.5,
          stuck: null,
          alpha: 0.9,
        });
      }

      /* Gather a few UI anchors for leaves to stick on. */
      let anchors: DOMRect[] = [];
      if (Math.random() < 0.05 || anchors.length === 0) {
        const shell = document.getElementById("app-shell");
        const buttons = shell
          ? Array.from(shell.querySelectorAll("button"))
          : [];
        anchors = buttons
          .filter((button) => button.offsetWidth > 20)
          .map((button) => button.getBoundingClientRect());
      }

      for (const p of particles) {
        p.life += 1 / 60;
        const fadeAt = p.ttl - 2;
        if (p.life > fadeAt) p.alpha = Math.max(0, 0.9 * (1 - (p.life - fadeAt) / 2));

        if (!p.stuck) {
          p.x += p.vx / 60;
          p.y += p.vy / 60;
          p.vy += 7 / 60;
          p.vx += Math.sin((p.life * p.wob + p.y / 40) * 2) * 0.32;
          if (p.vy > 0 && anchors.length > 0 && Math.random() < 0.004) {
            const spot = anchors[Math.floor(Math.random() * anchors.length)];
            p.x = spot.left + spot.width * (0.5 + Math.random() * 0.5);
            p.y = spot.top + Math.random() * Math.min(14, spot.height * 0.3);
            p.stuck = { x: p.x, y: p.y };
          }
        } else if (p.life > Math.min(p.ttl - 0.8, 7)) {
          p.stuck = null;
        }

        if (
          p.x < box.left - 24 ||
          p.x > box.left + box.width + 24 ||
          p.y > box.top + box.height + 24 ||
          p.life > p.ttl ||
          p.alpha <= 0
        ) {
          p.life = Infinity;
        }
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        if (particles[i].life === Infinity) particles.splice(i, 1);
      }

      draw();
      requestAnimationFrame(step);
    };

    const resize = () => {
      const box = appBox();
      canvas.width = box.width;
      canvas.height = box.height;
      canvas.style.left = `${box.left}px`;
      canvas.style.top = `${box.top}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    requestAnimationFrame(step);
    return () => {
      running = false;
      /* Disarmed or unmounted: wipe the canvas so no stray pixels
         stay pinned over the design. */
      context.clearRect(0, 0, canvas.width, canvas.height);
      window.removeEventListener("resize", resize);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-cheat-foliage=""
      className="pointer-events-none fixed z-[35]"
      style={{ imageRendering: "pixelated" }}
    />
  );
}