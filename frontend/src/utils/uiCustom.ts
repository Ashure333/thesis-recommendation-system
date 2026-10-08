/**
 * Customizations of the whole UI: looks (skins), effects, and the live
 * background. They are the hidden cheats' rewards and the developer panel's
 * switches.
 *
 * A skin replaces the theme's color tokens (canvas, surface, ink, accent,
 * the gray ramp ...) while it is on, and sets `data-skin` on the document so
 * the style sheet can add its own touches (fonts, grain, grids). Effects are
 * plain data attributes. Nothing here changes layout or content.
 *
 * The apply step only touches the document; the theme provider re-applies
 * the theme first and then this, so turning a skin off restores the theme
 * exactly.
 */

export type SkinId =
  | "gameboy"
  | "wood"
  | "terminal"
  | "blueprint"
  | "synthwave"
  | "parchment";

export interface UiSkin {
  id: SkinId;
  label: string;
  mode: "light" | "dark";
  /** Space-separated RGB triplets, as the theme tokens are. */
  canvas: string;
  surface: string;
  surfaceAlt: string;
  hairline: string;
  ink: string;
  muted: string;
  field: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
}

const t = (s: string) => s.split(" ").map(Number);
const mix = (a: number[], b: number[], k: number) =>
  a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(" ");

export const SKINS: UiSkin[] = [
  {
    id: "gameboy",
    label: "Pocket Green",
    mode: "light",
    canvas: "155 188 15",
    surface: "139 172 15",
    surfaceAlt: "125 158 14",
    hairline: "48 98 48",
    ink: "15 56 15",
    muted: "15 56 15",
    field: "155 188 15",
    accent: "15 56 15",
    accentSoft: "139 172 15",
    onAccent: "155 188 15",
  },
  {
    id: "wood",
    label: "Lumberyard",
    mode: "light",
    canvas: "217 185 131",
    surface: "236 214 168",
    surfaceAlt: "226 198 146",
    hairline: "150 110 60",
    ink: "43 26 10",
    muted: "90 58 26",
    field: "240 224 190",
    accent: "140 80 20",
    accentSoft: "240 224 190",
    onAccent: "255 244 220",
  },
  {
    id: "terminal",
    label: "Phosphor",
    mode: "dark",
    canvas: "6 14 8",
    surface: "10 24 12",
    surfaceAlt: "14 34 18",
    hairline: "30 90 45",
    ink: "120 255 140",
    muted: "80 200 100",
    field: "8 20 10",
    accent: "60 255 100",
    accentSoft: "16 48 24",
    onAccent: "0 20 5",
  },
  {
    id: "blueprint",
    label: "Blueprint",
    mode: "dark",
    canvas: "14 48 88",
    surface: "18 62 112",
    surfaceAlt: "22 74 130",
    hairline: "90 150 210",
    ink: "220 238 255",
    muted: "160 200 235",
    field: "16 56 104",
    accent: "120 200 255",
    accentSoft: "28 84 148",
    onAccent: "6 30 60",
  },
  {
    id: "synthwave",
    label: "Neon Horizon",
    mode: "dark",
    canvas: "24 8 48",
    surface: "40 14 72",
    surfaceAlt: "56 20 96",
    hairline: "140 60 200",
    ink: "255 220 250",
    muted: "210 160 235",
    field: "32 10 60",
    accent: "255 60 180",
    accentSoft: "70 24 120",
    onAccent: "20 4 40",
  },
  {
    id: "parchment",
    label: "Old Parchment",
    mode: "light",
    canvas: "238 226 196",
    surface: "247 238 214",
    surfaceAlt: "232 216 178",
    hairline: "170 140 90",
    ink: "62 44 24",
    muted: "104 80 50",
    field: "250 244 226",
    accent: "140 60 30",
    accentSoft: "226 208 166",
    onAccent: "250 240 220",
  },
];

export interface LiveBackground {
  on: boolean;
  /** A garden scene id, or "garden" to follow the garden's own scene. */
  scene: string;
  /** How much the page color covers the scene, 0.6..0.95. */
  dim: number;
  /** Still picture instead of moving. */
  still: boolean;
}

export interface UiCustom {
  skin: SkinId | null;
  crt: boolean;
  pixelFont: boolean;
  live: LiveBackground;
  /** Hidden cheats the player has found. */
  discovered: string[];
}

export const DEFAULT_UI_CUSTOM: UiCustom = {
  skin: null,
  crt: false,
  pixelFont: false,
  live: { on: false, scene: "garden", dim: 0.78, still: false },
  discovered: [],
};

export const UI_CUSTOM_KEY = "paperrec_ui_custom";
export const UI_CUSTOM_EVENT = "paperrec:ui-custom";

export function normalize(raw: unknown): UiCustom {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<UiCustom> & {
    live?: Partial<LiveBackground>;
  };
  const skin = SKINS.some((s) => s.id === o.skin) ? (o.skin as SkinId) : null;
  const live: Partial<LiveBackground> = o.live ?? {};
  const dim = typeof live.dim === "number" ? Math.min(0.95, Math.max(0.6, live.dim)) : DEFAULT_UI_CUSTOM.live.dim;

  return {
    skin,
    crt: o.crt === true,
    pixelFont: o.pixelFont === true,
    live: {
      on: live.on === true,
      scene: typeof live.scene === "string" ? live.scene : "garden",
      dim,
      still: live.still === true,
    },
    discovered: Array.isArray(o.discovered)
      ? o.discovered.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export function readUiCustom(): UiCustom {
  try {
    const raw = window.localStorage.getItem(UI_CUSTOM_KEY);

    return normalize(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_UI_CUSTOM;
  }
}

export function writeUiCustom(next: UiCustom): void {
  try {
    window.localStorage.setItem(UI_CUSTOM_KEY, JSON.stringify(normalize(next)));
  } catch {
    /* private mode: it just doesn't persist */
  }
  window.dispatchEvent(new Event(UI_CUSTOM_EVENT));
}

/** The gray ramp the style sheet reads (gray-50 .. gray-950), canvas to ink. */
export function grayRamp(skin: UiSkin): Record<string, string> {
  const from = t(skin.canvas);
  const to = t(skin.ink);
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  /* the light end of a skin's ramp stays near the canvas, the dark end
     near the ink, and gray-600 (muted text) lands on the skin's muted */
  const out: Record<string, string> = {};

  for (const step of steps) {
    const k = step <= 100 ? step / 1000 : step >= 800 ? 0.8 + (step - 800) / 750 : step / 1000;

    out[String(step)] = step === 600 ? skin.muted : mix(from, to, Math.min(1, k));
  }

  return out;
}

const SKIN_VARS = [
  "--accent",
  "--accent-soft",
  "--canvas",
  "--surface",
  "--surface-alt",
  "--hairline",
  "--ink",
  "--muted",
  "--field",
  "--on-accent",
  "--on-ink",
  "--signal-tfidf",
  "--signal-sbert",
  "--signal-meta",
  "--tag-cs",
  "--tag-math",
];

/** Put the customizations on the document. Call after the theme is applied. */
export function applyUiCustom(root: HTMLElement = document.documentElement): void {
  const custom = readUiCustom();
  const skin = SKINS.find((s) => s.id === custom.skin) ?? null;

  if (skin) {
    const set = (name: string, value: string) => root.style.setProperty(name, value);

    set("--accent", skin.accent);
    set("--accent-soft", skin.accentSoft);
    set("--canvas", skin.canvas);
    set("--surface", skin.surface);
    set("--surface-alt", skin.surfaceAlt);
    set("--hairline", skin.hairline);
    set("--ink", skin.ink);
    set("--muted", skin.muted);
    set("--field", skin.field);
    set("--on-accent", skin.onAccent);
    set("--on-ink", skin.canvas);
    /* the pipeline and subject colors follow the skin's own accent family */
    const accent = t(skin.accent);
    const ink = t(skin.ink);

    set("--signal-tfidf", mix(accent, ink, 0.0));
    set("--signal-sbert", mix(accent, t(skin.canvas), 0.35));
    set("--signal-meta", mix(accent, ink, 0.45));
    set("--tag-cs", mix(accent, ink, 0.2));
    set("--tag-math", mix(accent, t(skin.canvas), 0.5));
    for (const [step, value] of Object.entries(grayRamp(skin))) {
      set(`--gray-${step}`, value);
    }
    root.dataset.skin = skin.id;
    root.dataset.mode = skin.mode;
    root.style.colorScheme = skin.mode;
  } else {
    delete root.dataset.skin;
  }

  const flag = (name: string, on: boolean) => {
    if (on) root.setAttribute(name, "");
    else root.removeAttribute(name);
  };

  flag("data-crt", custom.crt);
  flag("data-pixelfont", custom.pixelFont);
  flag("data-live-bg", custom.live.on);
}

export { SKIN_VARS };
