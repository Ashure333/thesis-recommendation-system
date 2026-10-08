/**
 * The garden's scene as a live background behind the whole app.
 *
 * It is the same pixel scene the garden shows, drawn small and stretched to
 * cover the window, with the page color laid over it so text keeps its
 * contrast: strongest over the reading column in the middle, a little lighter
 * toward the edges where the scene can show. The player chooses how much the
 * page color covers (the `dim` setting, never below 60%). It sits behind
 * everything, takes no clicks, and stops moving when the tab is hidden or the
 * player prefers reduced motion.
 */

import GardenBackdrop from "./retro/GardenBackdrop";
import {
  BACKDROP_THEMES,
  DEFAULT_BACKDROP_THEME,
  type BackdropThemeId,
} from "../data/backdrops";
import { useUiCustom } from "../state/uiCustom";
import SkinWallpaper from "./wallpaper/SkinWallpaper";

const GARDEN_ACTIVE_KEY = "paperrec_backdrop_theme";

function gardenScene(): BackdropThemeId {
  try {
    const raw = window.localStorage.getItem(GARDEN_ACTIVE_KEY);

    if (raw && BACKDROP_THEMES.some((theme) => theme.id === raw)) {
      return raw as BackdropThemeId;
    }
  } catch {
    /* fall through */
  }

  return DEFAULT_BACKDROP_THEME;
}

export default function LiveBackground() {
  const { custom } = useUiCustom();
  const live = custom.live;
  /* a look's own wallpaper, unless the garden's scene was asked for */
  const wallpaper = !live.on && custom.skin !== null && custom.wallpaper ? custom.skin : null;

  if (!live.on && !wallpaper) return null;

  const scene: BackdropThemeId =
    live.scene === "garden"
      ? gardenScene()
      : BACKDROP_THEMES.some((theme) => theme.id === live.scene)
        ? (live.scene as BackdropThemeId)
        : DEFAULT_BACKDROP_THEME;
  /* A look's wallpaper is the point of the look, so the page color lies
     lighter over it than over the garden's scene (the cards and the text
     keep their own opaque backgrounds). */
  const center = wallpaper ? Math.max(0.45, live.dim - 0.2) : live.dim;
  const edge = wallpaper ? center * 0.45 : Math.max(0.5, live.dim * 0.7);

  return (
    <div
      aria-hidden="true"
      data-live-background=""
      className="live-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {wallpaper ? (
        <SkinWallpaper skin={wallpaper} still={live.still} />
      ) : (
        <GardenBackdrop theme={scene} parallax={0} maxFps={live.still ? 0.2 : 10} />
      )}
      {/* the page color over the scene: heavy in the middle, lighter at the sides */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 90% at 50% 45%, rgb(var(--canvas) / ${center}) 0%, rgb(var(--canvas) / ${center}) 55%, rgb(var(--canvas) / ${edge}) 100%)`,
        }}
      />
    </div>
  );
}
