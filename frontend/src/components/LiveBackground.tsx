/**
 * The garden's scene as a live background behind the whole app.
 *
 * It is the same pixel scene the garden shows, drawn small and stretched to
 * cover the window, with the page colour laid over it so text keeps its
 * contrast: strongest over the reading column in the middle, a little lighter
 * toward the edges where the scene can show. The player chooses how much the
 * page colour covers (the `dim` setting, never below 60%). It sits behind
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

  if (!live.on) return null;

  const scene: BackdropThemeId =
    live.scene === "garden"
      ? gardenScene()
      : BACKDROP_THEMES.some((theme) => theme.id === live.scene)
        ? (live.scene as BackdropThemeId)
        : DEFAULT_BACKDROP_THEME;
  const edge = Math.max(0.5, live.dim * 0.7);

  return (
    <div
      aria-hidden="true"
      data-live-background=""
      className="live-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <GardenBackdrop theme={scene} parallax={0} maxFps={live.still ? 0.2 : 10} />
      {/* the page colour over the scene: heavy in the middle, lighter at the sides */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 90% at 50% 45%, rgb(var(--canvas) / ${live.dim}) 0%, rgb(var(--canvas) / ${live.dim}) 55%, rgb(var(--canvas) / ${edge}) 100%)`,
        }}
      />
    </div>
  );
}
