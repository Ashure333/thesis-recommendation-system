import { UI_CUSTOM_EVENT, applyUiCustom } from "./utils/uiCustom";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

/* ============================================================
   THEME PALETTES
   Every theme owns a full palette, not just an accent:
   the background canvas, surfaces, hairlines, ink, muted text
   and input fields all shift with the theme. Tailwind maps the
   neutral scale (gray-100..950) onto CSS variables, so the
   entire UI follows the palette without per-component edits.

   Role of each token:
   - canvas      → page background
   - surface     → cards / panels (white fill)
   - surface-alt → tinted panels / hover washes
   - hairline    → row separators (was gray-200)
   - ink         → text + 3px outlines (was gray-900)
   - muted       → secondary text (was gray-600)
   - field       → input fills
   - accent      → primary / active fills AND decorative text;
                   deepened 500/600-level shades so both roles
                   stay readable on the canvas
   - soft        → hover wash on the canvas (100-level tint)
   - gray 50-950 → the neutral ramp, tinted toward the theme hue

   Values are space-separated RGB triplets so Tailwind can apply
   alpha modifiers: rgb(var(--accent) / 0.5).
   ============================================================ */

export type AccentId =
  | "amber"
  | "coral"
  | "violet"
  | "sky"
  | "mint"
  | "rose"
  | "mono"
  | "copper"
  | "indigo"
  | "lime"
  | "pink"
  | "cyan";

export type ThemeMode = "light" | "dark";

export interface AccentOption extends PaletteTokens {
  id: AccentId;
  label: string;
  accent: string;
  soft: string;
  canvas: string;
  surface: string;
  surfaceAlt: string;
  hairline: string;
  ink: string;
  muted: string;
  field: string;
  gray: Record<string, string>;
  /**
   * Optional explicit pipeline signal colors (peach/copper/teal
   * complementary themes). When absent, the signals are derived
   * as tonal shades of the accent.
   */
  signals?: { tfidf: string; sbert: string; meta: string };
}

export const ACCENTS: AccentOption[] = [
  {
    id: "amber",
    label: "Amber",
    accent: "243 156 18",      // Flat UI Orange
    soft: "253 236 207",
    canvas: "255 250 240",
    surface: "254 247 236",
    surfaceAlt: "254 242 222",
    hairline: "242 239 230",
    ink: "44 62 80",           // Flat UI Midnight Blue
    muted: "99 112 126",
    field: "254 242 220",
    gray: {
      "50": "249 244 235",
      "100": "244 241 232",
      "200": "242 239 230",
      "300": "221 220 214",
      "400": "172 179 185",
      "500": "140 148 155",
      "600": "99 112 126",
      "700": "82 98 115",
      "800": "56 74 92",
      "900": "44 62 80",
      "950": "26 35 44",
    },
  },

  {
    id: "coral",
    label: "Coral",
    accent: "230 126 34",      // Flat UI Carrot
    soft: "251 227 207",
    canvas: "255 245 237",
    surface: "253 245 238",
    surfaceAlt: "253 235 221",
    hairline: "242 234 228",
    ink: "44 62 80",
    muted: "99 112 126",
    field: "253 234 219",
    gray: {
      "50": "249 240 232",
      "100": "244 236 229",
      "200": "242 234 228",
      "300": "221 216 212",
      "400": "172 179 185",
      "500": "140 148 155",
      "600": "99 112 126",
      "700": "82 98 115",
      "800": "56 74 92",
      "900": "44 62 80",
      "950": "26 35 44",
    },
  },

  {
    id: "violet",
    label: "Violet",
    accent: "176 111 240",     // Flat UI Amethyst, lightened for ink-on-accent contrast
    soft: "237 224 250",
    canvas: "248 244 252",
    surface: "249 243 254",
    surfaceAlt: "242 233 251",
    hairline: "236 233 242",
    ink: "44 62 80",
    muted: "99 112 126",
    field: "242 232 251",
    gray: {
      "50": "242 239 247",
      "100": "238 235 243",
      "200": "236 233 242",
      "300": "215 215 224",
      "400": "172 179 185",
      "500": "140 148 155",
      "600": "99 112 126",
      "700": "82 98 115",
      "800": "56 74 92",
      "900": "44 62 80",
      "950": "26 35 44",
    },
  },

  {
    id: "sky",
    label: "Sky",
    accent: "52 152 219",      // Flat UI Peter River
    soft: "212 233 248",
    canvas: "240 247 253",
    surface: "239 247 252",
    surfaceAlt: "225 239 250",
    hairline: "228 236 243",
    ink: "44 62 80",
    muted: "99 112 126",
    field: "223 238 250",
    gray: {
      "50": "234 241 248",
      "100": "230 238 244",
      "200": "228 236 243",
      "300": "209 217 225",
      "400": "172 179 185",
      "500": "140 148 155",
      "600": "99 112 126",
      "700": "82 98 115",
      "800": "56 74 92",
      "900": "44 62 80",
      "950": "26 35 44",
    },
  },

  {
    id: "mint",
    label: "Mint",
    accent: "22 160 133",      // Flat UI Green Sea
    soft: "207 236 230",
    canvas: "240 250 247",
    surface: "236 247 245",
    surfaceAlt: "223 243 238",
    hairline: "228 239 237",
    ink: "44 62 80",
    muted: "99 112 126",
    field: "220 242 237",
    gray: {
      "50": "234 244 242",
      "100": "230 241 239",
      "200": "228 239 237",
      "300": "209 220 220",
      "400": "172 179 185",
      "500": "140 148 155",
      "600": "99 112 126",
      "700": "82 98 115",
      "800": "56 74 92",
      "900": "44 62 80",
      "950": "26 35 44",
    },
  },

  {
    id: "rose",
    label: "Rose",
    accent: "240 98 74",       // Flat UI Alizarin, lightened for ink-on-accent contrast
    soft: "253 222 218",
    canvas: "255 244 243",
    surface: "254 242 240",
    surfaceAlt: "254 232 229",
    hairline: "242 233 233",
    ink: "44 62 80",
    muted: "99 112 126",
    field: "254 231 228",
    gray: {
      "50": "249 239 238",
      "100": "244 235 235",
      "200": "242 233 233",
      "300": "221 215 217",
      "400": "172 179 185",
      "500": "140 148 155",
      "600": "99 112 126",
      "700": "82 98 115",
      "800": "56 74 92",
      "900": "44 62 80",
      "950": "26 35 44",
    },
  },

  {
    id: "mono",
    label: "Mono",
    accent: "143 153 154",     // Flat UI Asbestos, lightened for ink-on-accent contrast
    soft: "225 229 230",
    canvas: "240 242 243",
    surface: "246 247 247",
    surfaceAlt: "232 235 236",
    hairline: "228 231 233",
    ink: "44 62 80",
    muted: "99 112 126",
    field: "231 234 235",
    gray: {
      "50": "234 237 238",
      "100": "230 233 235",
      "200": "228 231 233",
      "300": "209 213 217",
      "400": "172 179 185",
      "500": "140 148 155",
      "600": "99 112 126",
      "700": "82 98 115",
      "800": "56 74 92",
      "900": "44 62 80",
      "950": "26 35 44",
    },
  },

  {
    // Peach / copper / teal — the complementary palette.
    // Golden-peach canvas, copper accents and bars, teal highlights.
    id: "copper",
    label: "Copper",
    accent: "206 138 78",      // copper
    soft: "253 233 210",
    canvas: "255 247 237",     // golden peach
    surface: "251 246 241",    // accent-tinted card
    surfaceAlt: "255 238 219",
    hairline: "240 228 212",
    ink: "58 38 26",           // dark bronze
    muted: "128 95 68",
    field: "255 240 222",
    gray: {
      "50": "252 248 243",
      "100": "247 240 232",
      "200": "240 228 214",
      "300": "222 205 186",
      "400": "177 155 133",
      "500": "140 117 96",
      "600": "128 95 68",
      "700": "97 71 51",
      "800": "76 53 37",
      "900": "58 38 26",
      "950": "40 24 15",
    },
    // Copper bars with a teal S-BERT segment (complementary).
    signals: {
      tfidf: "206 138 78",
      sbert: "18 128 112",     // muted slate-teal
      meta: "222 174 116",     // light copper
    },
  },

  {
    id: "indigo",
    label: "Indigo",
    accent: "99 102 241",      // bright indigo (white ink on accent)
    soft: "226 227 253",
    canvas: "244 244 253",
    surface: "246 246 254",
    surfaceAlt: "234 235 252",
    hairline: "232 233 247",
    ink: "44 62 80",
    muted: "99 112 126",
    field: "232 233 252",
    gray: {
      "50": "240 240 250",
      "100": "235 235 246",
      "200": "232 233 247",
      "300": "212 213 229",
      "400": "172 179 185",
      "500": "140 148 155",
      "600": "99 112 126",
      "700": "82 98 115",
      "800": "56 74 92",
      "900": "44 62 80",
      "950": "26 35 44",
    },
  },

  {
    id: "lime",
    label: "Lime",
    accent: "132 204 22",      // yellow-green (dark ink on accent)
    soft: "238 249 219",
    canvas: "249 252 242",
    surface: "250 252 244",
    surfaceAlt: "242 248 227",
    hairline: "239 243 230",
    ink: "44 62 80",
    muted: "99 112 126",
    field: "240 248 224",
    gray: {
      "50": "245 248 238",
      "100": "241 244 234",
      "200": "239 243 230",
      "300": "219 223 210",
      "400": "172 179 185",
      "500": "140 148 155",
      "600": "99 112 126",
      "700": "82 98 115",
      "800": "56 74 92",
      "900": "44 62 80",
      "950": "26 35 44",
    },
  },

  {
    id: "pink",
    label: "Pink",
    accent: "236 72 153",      // magenta-pink (white ink on accent)
    soft: "252 231 243",
    canvas: "253 243 249",
    surface: "254 244 250",
    surfaceAlt: "252 232 244",
    hairline: "243 233 240",
    ink: "44 62 80",
    muted: "99 112 126",
    field: "253 233 245",
    gray: {
      "50": "249 240 246",
      "100": "245 236 242",
      "200": "243 233 240",
      "300": "222 213 220",
      "400": "172 179 185",
      "500": "140 148 155",
      "600": "99 112 126",
      "700": "82 98 115",
      "800": "56 74 92",
      "900": "44 62 80",
      "950": "26 35 44",
    },
  },

  {
    id: "cyan",
    label: "Cyan",
    accent: "6 182 212",       // turquoise-cyan (dark ink on accent)
    soft: "207 240 248",
    canvas: "238 250 253",
    surface: "240 251 253",
    surfaceAlt: "222 244 250",
    hairline: "229 239 243",
    ink: "44 62 80",
    muted: "99 112 126",
    field: "221 243 250",
    gray: {
      "50": "234 244 248",
      "100": "230 240 244",
      "200": "229 239 243",
      "300": "210 221 226",
      "400": "172 179 185",
      "500": "140 148 155",
      "600": "99 112 126",
      "700": "82 98 115",
      "800": "56 74 92",
      "900": "44 62 80",
      "950": "26 35 44",
    },
  },
];

const STORAGE_KEY = "paperrec_accent";
const MODE_STORAGE_KEY = "paperrec_mode";

export function readStoredAccent(): AccentId {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored && ACCENTS.some((option) => option.id === stored)) {
      return stored as AccentId;
    }
  } catch {
    // localStorage can be unavailable (private mode); fall through.
  }

  return "amber";
}

export function readStoredMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY);

    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // localStorage can be unavailable (private mode); fall through.
  }

  // No stored choice: follow the operating system's preference.
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

/* ============================================================
   AUTO TEXT COLOR
   Picks the more legible of a fixed DARK reference / white
   against a fill by WCAG relative luminance. Keeps text
   readable on any accent (or future palette) without
   hand-tuning per theme.

   The DARK reference is the deep-navy end of the ramp
   ("26 35 44"), NOT the theme's ink: in dark mode the ink
   token becomes near-white, and fills (ink / gray-900)
   lighten with it -- so text on those fills must fall back
   to the dark end instead of to white. Light-mode behavior
   is unchanged, because every light theme's ink already is
   that deep navy.
   ============================================================ */

const WHITE = "255 255 255";
const DARK = "26 35 44";

function channelToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(triplet: string): number {
  const [r, g, b] = triplet.split(" ").map(Number).map(channelToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Best text color (DARK or white) to sit on top of `fill`. */
function pickOnColor(fill: string): string {
  return contrastRatio(fill, DARK) >= contrastRatio(fill, WHITE) ? DARK : WHITE;
}

/* ============================================================
   PIPELINE SIGNAL COLORS
   The three recommendation signals (TF-IDF, S-BERT, Metadata)
   form a TRIADIC scheme around the theme accent: one keeps the
   accent hue, the others rotate ±120° on the color wheel (e.g.
   amber → orange / green / purple). Lightness is clamped per
   hue so no segment drifts dark or vanishes on the white bar.
   Achromatic accents (e.g. mono) fall back to fixed distinct
   hues so the bars stay distinguishable.
   ============================================================ */

// Fallback triplets for near-achromatic accents (mono theme).
const SIGNAL_FALLBACK = {
  tfidf: "31 147 133",
  sbert: "201 85 43",
  meta: "110 86 207",
};

function tripletToHsl(triplet: string): { h: number; s: number; l: number } {
  const [r, g, b] = triplet.split(" ").map(Number).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / delta + 2) * 60;
    else h = ((r - g) / delta + 4) * 60;
  }

  return { h, s, l };
}

function hslToTriplet(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  return `${Math.round((r + m) * 255)} ${Math.round((g + m) * 255)} ${Math.round((b + m) * 255)}`;
}

/**
 * Legible lightness per hue: yellow/green hues (35–165) are very
 * bright at 0.5 and would vanish on the white bar track, so they
 * get 0.38; all other hues stay at 0.5. (Used by the cs/math tags.)
 */
function legibleLightness(hue: number): number {
  return hue >= 35 && hue <= 165 ? 0.38 : 0.5;
}

/** Rotate hue by `degrees`, keep saturation, clamp lightness. */
function shiftHue(triplet: string, degrees: number): string {
  const { h, s } = tripletToHsl(triplet);
  const hue = ((h + degrees) % 360 + 360) % 360;
  return hslToTriplet(hue, s, legibleLightness(hue));
}

function signalColors(accent: string): { tfidf: string; sbert: string; meta: string } {
  const { s } = tripletToHsl(accent);

  if (s < 0.15) {
    return { ...SIGNAL_FALLBACK };
  }

  // Analogous triad: accent ±30° around the color wheel, with the
  // per-hue legibility clamp. Distinct enough to read at bar size,
  // close enough to never clash.
  return {
    tfidf: accent,
    sbert: shiftHue(accent, 30),
    meta: shiftHue(accent, -30),
  };
}

/* ============================================================
   SUBJECT TAG COLORS
   CS / Math tags adapt to the theme too: accent ±150° with the
   same legibility clamp; achromatic accents fall back to fixed
   blue / green.
   ============================================================ */

const TAG_FALLBACK = {
  cs: "37 99 235",
  math: "47 158 79",
};

function tagColors(accent: string): { cs: string; math: string } {
  const { s } = tripletToHsl(accent);

  if (s < 0.15) {
    return { ...TAG_FALLBACK };
  }

  return {
    cs: shiftHue(accent, 150),
    math: shiftHue(accent, -150),
  };
}

/* ============================================================
   DARK MODE PALETTES
   Every theme's dark version is DERIVED from its light palette
   (plus the accent hue) instead of being hand-tuned per theme:
   dark surfaces, light ink, and a reversed neutral ramp. Same
   derivation for every accent, so all 12 themes -- current and
   future -- get a dark version for free, and the two modes stay
   in lockstep when a palette is edited.

   The neutral ramp REVERSES in dark mode: gray-50 becomes the
   darkest step and gray-950 the lightest. That single inversion
   is what keeps the design language's hard-coded classes working
   without per-component edits:
     - border-gray-900 (the 3px ink outlines) -> light, visible
     - text-gray-900 / text-ink (body text)    -> light
     - text-gray-600 (muted)                   -> mid tone
     - bg-gray-900 (slabs, filled buttons)     -> light fill
     - bg-white (maps to --surface)            -> dark surface
   ============================================================ */

interface PaletteTokens {
  canvas: string;
  surface: string;
  surfaceAlt: string;
  hairline: string;
  ink: string;
  muted: string;
  field: string;
  soft: string;
  gray: Record<string, string>;
}

// Dark-mode lightness steps for the reversed neutral ramp (50..950).
const DARK_GRAY_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const DARK_GRAY_LIGHTNESS = [
  0.10, 0.14, 0.175, 0.23, 0.29, 0.36, 0.44, 0.54, 0.66, 0.78, 0.90,
];

export function deriveDarkTokens(option: AccentOption): PaletteTokens {
  const { h, s } = tripletToHsl(option.accent);
  const graySaturation = s * 0.45;
  const gray = (lightness: number) =>
    hslToTriplet(h, graySaturation, lightness);

  return {
    canvas: hslToTriplet(h, s * 0.55, 0.075),
    surface: hslToTriplet(h, s * 0.5, 0.115),
    surfaceAlt: hslToTriplet(h, s * 0.5, 0.15),
    hairline: hslToTriplet(h, s * 0.35, 0.24),
    ink: hslToTriplet(h, 0.06, 0.92),
    muted: hslToTriplet(h, 0.12, 0.66),
    field: hslToTriplet(h, s * 0.5, 0.175),
    // Hover wash on the dark canvas: an accent-tinted panel instead
    // of the light mode's pale tint (achromatic accents stay gray).
    soft: hslToTriplet(
      h,
      s >= 0.15 ? Math.max(0.5, s * 1.1) : graySaturation,
      0.19,
    ),
    gray: Object.fromEntries(
      DARK_GRAY_STEPS.map((step, index) => [
        String(step),
        gray(DARK_GRAY_LIGHTNESS[index]),
      ]),
    ),
  };
}

export function applyAccent(id: AccentId, mode: ThemeMode = "light"): void {
  const option = ACCENTS.find((item) => item.id === id) ?? ACCENTS[0];
  const root = document.documentElement;

  const palette: PaletteTokens =
    mode === "dark" ? deriveDarkTokens(option) : option;

  root.style.setProperty("--accent", option.accent);
  root.style.setProperty("--accent-soft", palette.soft);
  root.style.setProperty("--canvas", palette.canvas);
  root.style.setProperty("--surface", palette.surface);
  root.style.setProperty("--surface-alt", palette.surfaceAlt);
  root.style.setProperty("--hairline", palette.hairline);
  root.style.setProperty("--ink", palette.ink);
  root.style.setProperty("--muted", palette.muted);
  root.style.setProperty("--field", palette.field);

  // Pipeline signal colors: explicit palette wins, otherwise the
  // accent derives tonal shades.
  const signals = option.signals ?? signalColors(option.accent);
  root.style.setProperty("--signal-tfidf", signals.tfidf);
  root.style.setProperty("--signal-sbert", signals.sbert);
  root.style.setProperty("--signal-meta", signals.meta);

  // Subject tag colors adapt too.
  const tags = tagColors(option.accent);
  root.style.setProperty("--tag-cs", tags.cs);
  root.style.setProperty("--tag-math", tags.math);

  // Auto-legibility against the two fixed ends of the ramp (the
  // accent never moves between modes; the ink token does).
  root.style.setProperty("--on-accent", pickOnColor(option.accent));
  root.style.setProperty("--on-ink", pickOnColor(palette.ink));

  for (const [step, value] of Object.entries(palette.gray)) {
    root.style.setProperty(`--gray-${step}`, value);
  }

  root.dataset.accent = option.id;
  root.dataset.mode = mode;
  root.style.colorScheme = mode;
}

/** "243 156 18" -> "#F39C12" (for inline swatch rendering). */
export function tripletToHex(triplet: string): string {
  return (
    "#" +
    triplet
      .split(" ")
      .map((channel) =>
        Number(channel).toString(16).padStart(2, "0"),
      )
      .join("")
  );
}

/* ============================================================
   CONTEXT
   ============================================================ */

interface ThemeContextValue {
  accent: AccentId;
  setAccent: (id: AccentId) => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  accent: "amber",
  setAccent: () => {},
  mode: "light",
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<AccentId>(() => readStoredAccent());
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode());

  useLayoutEffect(() => {
    applyAccent(accent, mode);
    /* then the player's look (a skin, effects) goes on top of the theme */
    applyUiCustom();
  }, [accent, mode]);

  /* a skin turned on or off: put the theme back, then re-apply the look */
  useEffect(() => {
    const reapply = () => {
      applyAccent(accent, mode);
      applyUiCustom();
    };

    window.addEventListener(UI_CUSTOM_EVENT, reapply);
    window.addEventListener("storage", reapply);

    return () => {
      window.removeEventListener(UI_CUSTOM_EVENT, reapply);
      window.removeEventListener("storage", reapply);
    };
  }, [accent, mode]);

  function setAccent(id: AccentId) {
    setAccentState(id);

    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Persisting is best-effort; the in-memory selection still applies.
    }
  }

  function setMode(nextMode: ThemeMode) {
    setModeState(nextMode);

    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, nextMode);
    } catch {
      // Persisting is best-effort; the in-memory selection still applies.
    }
  }

  return (
    <ThemeContext.Provider value={{ accent, setAccent, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}