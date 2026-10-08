/* ============================================================
   SPECIES PREVIEW — a tree in its garden, painted live.

   The Theme shop shows each scene as a pixel still; this does the same
   for a tree species: the active scene's backdrop with the species'
   full-crowned tree standing in it, at 1x so the scene and the tree
   share one pixel size exactly as they do in the real garden.
   ============================================================ */

import { useEffect, useRef } from "react";

import PixelGrowthTree from "./PixelGrowthTree";
import {
  BACKDROP_H,
  BACKDROP_W,
  backdropStill,
  type BackdropThemeId,
} from "../../data/backdrops";
import { treeSpecies, type TreeSpeciesId } from "../../data/knowledge";
import { useTreeVariant } from "../../state/treeVariant";

/* Growth at which every species shows its whole crown, just before the
   camera starts to zoom into the trunk. */
const PREVIEW_GROWTH = 0.42;

export default function SpeciesPreview({
  speciesId,
  theme,
  dim = false,
}: {
  speciesId: TreeSpeciesId;
  theme: BackdropThemeId;
  /** A species you do not own yet is shown a little dimmer. */
  dim?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  /* The cards show each tree in the colours the player chose for it. */
  const [variantId] = useTreeVariant(speciesId);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) backdropStill(ctx, theme);
  }, [theme]);

  return (
    <div
      role="img"
      aria-label={`${treeSpecies(speciesId).label} in the garden`}
      className="relative box-content shrink-0 overflow-hidden rounded border-[2px] border-gray-900"
      style={{ width: BACKDROP_W, height: BACKDROP_H }}
    >
      <canvas
        ref={ref}
        width={BACKDROP_W}
        height={BACKDROP_H}
        aria-hidden="true"
        className="absolute inset-0 block"
        style={{
          width: BACKDROP_W,
          height: BACKDROP_H,
          imageRendering: "pixelated",
        }}
      />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <PixelGrowthTree
          speciesId={speciesId}
          growth={PREVIEW_GROWTH}
          cssScale={1}
          variantId={variantId}
          static
        />
      </div>
      {dim && <div className="absolute inset-0 bg-black/30" />}
    </div>
  );
}
