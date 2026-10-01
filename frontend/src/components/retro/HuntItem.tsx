import { useHunt } from "../../state/hunt";
import type { HuntItem as HuntItemDef } from "../../data/hunt";

/* ============================================================
   HUNT ITEM — one hidden treasure.
   A small, dim, blinking sparkle pinned to a fixed spot on its
   page. Hovering it makes it light up; clicking collects it,
   which makes it disappear and notifies the pet to celebrate.
   ============================================================ */

export default function HuntItem({ item }: { item: HuntItemDef }) {
  const { found, collect } = useHunt();

  if (found.includes(item.id)) return null;

  return (
    <button
      type="button"
      aria-label={`Hidden treasure: ${item.name}`}
      title="?"
      onClick={() => collect(item.id)}
      className={`group fixed z-40 flex h-4 w-4 items-center justify-center rounded-sm border-2 border-gray-900/30 bg-accent/30 transition duration-100 hover:z-50 hover:scale-150 hover:border-gray-900 hover:bg-accent ${item.position}`}
    >
      <span className="animate-pulse h-1.5 w-1.5 rotate-45 bg-white/80 transition group-hover:bg-white" />
    </button>
  );
}