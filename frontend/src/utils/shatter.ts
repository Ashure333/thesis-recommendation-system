/**
 * Pixel shatter: an element breaks into a grid of pieces, each a clipped copy
 * of the real thing, that tumble away and fade in a few chunky steps.
 *
 * The geometry and the motion are pure (and tested); `shatterElements` is
 * the only part that touches the DOM.
 */

export interface Shard {
  /** Cell's top-left inside the element. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Cut a w x h box into cells of about `cell` px (the last ones may be smaller). */
export function shardGrid(w: number, h: number, cell: number): Shard[] {
  const shards: Shard[] = [];
  const size = Math.max(2, Math.round(cell));

  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      shards.push({ x, y, w: Math.min(size, w - x), h: Math.min(size, h - y) });
    }
  }

  return shards;
}

export interface ShardMotion {
  dx: number;
  dy: number;
  rot: number;
  delay: number;
}

/** A small deterministic hash in 0..1, so a given shard always flies the same way. */
function unit(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;

  return s - Math.floor(s);
}

/**
 * Where piece `index` of `total` goes: outward from the middle of the break
 * (by its position in the grid), then pulled down, with a little spin.
 */
export function shardMotion(shard: Shard, box: { w: number; h: number }, index: number): ShardMotion {
  const cx = shard.x + shard.w / 2 - box.w / 2;
  const cy = shard.y + shard.h / 2 - box.h / 2;
  const spread = 0.9 + unit(index) * 1.3;

  return {
    dx: Math.round(cx * spread + (unit(index + 17) - 0.5) * 36),
    dy: Math.round(cy * spread + 30 + unit(index + 41) * 90),
    rot: Math.round((unit(index + 7) - 0.5) * 240),
    delay: Math.round(unit(index + 3) * 120),
  };
}

export const SHATTER_MS = 760;

/** Break copies of these elements apart where they stand. Call before removing them. */
export function shatterElements(elements: Element[], cell = 9): void {
  if (typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const layer = document.createElement("div");

  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";

  for (const element of elements) {
    const rect = element.getBoundingClientRect();

    if (rect.width < 2 || rect.height < 2) continue;

    const box = { w: Math.ceil(rect.width), h: Math.ceil(rect.height) };
    const grid = shardGrid(box.w, box.h, cell);

    grid.forEach((shard, index) => {
      const motion = shardMotion(shard, box, index);
      const piece = document.createElement("div");
      const copy = element.cloneNode(true) as HTMLElement;

      copy.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      copy.removeAttribute("id");
      copy.removeAttribute("data-nerd");
      copy.style.cssText += `;position:absolute;left:${-shard.x}px;top:${-shard.y}px;width:${box.w}px;height:${box.h}px;margin:0;pointer-events:none`;

      piece.className = "nerd-shard";
      piece.style.cssText =
        `position:absolute;left:${rect.left + shard.x}px;top:${rect.top + shard.y}px;` +
        `width:${shard.w}px;height:${shard.h}px;overflow:hidden;` +
        `--dx:${motion.dx}px;--dy:${motion.dy}px;--rot:${motion.rot}deg;--delay:${motion.delay}ms`;
      piece.appendChild(copy);
      layer.appendChild(piece);
    });
  }

  if (!layer.childElementCount) return;

  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), SHATTER_MS + 200);
}
