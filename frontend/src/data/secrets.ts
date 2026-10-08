/* ============================================================
   SECRETS — the hidden cheats.

   They change the look of the whole app, not just the garden. None
   of them is listed anywhere until it has been found by typing its
   word into the cheat console (the ` key). Each word is also a
   toggle: type it again to switch the look off.

   The developer panels list them all, found or not.
   ============================================================ */

import type { SkinId } from "../utils/uiCustom";

export type SecretKind = "skin" | "crt" | "pixelFont" | "live";

export interface Secret {
  id: string;
  word: string;
  label: string;
  kind: SecretKind;
  skin?: SkinId;
  /** A riddle for the word, shown once a cheat nearby is found. */
  hint: string;
  blurb: string;
}

export const SECRETS: Secret[] = [
  {
    id: "gameboy",
    word: "dmg",
    label: "Pocket Green",
    kind: "skin",
    skin: "gameboy",
    hint: "A gray brick from 1989 that played in four shades of green.",
    blurb: "The whole app on a handheld's four-shade green screen.",
  },
  {
    id: "wood",
    word: "lumber",
    label: "Lumberyard",
    kind: "skin",
    skin: "wood",
    hint: "What the garden's menu is made of, felled and planed.",
    blurb: "Warm oak boards and carved edges everywhere.",
  },
  {
    id: "terminal",
    word: "matrix",
    label: "Phosphor",
    kind: "skin",
    skin: "terminal",
    hint: "Follow the white rabbit; the glass is green.",
    blurb: "Green phosphor on black, like an old terminal.",
  },
  {
    id: "blueprint",
    word: "drafting",
    label: "Blueprint",
    kind: "skin",
    skin: "blueprint",
    hint: "Architects' paper, white lines on cyan-blue.",
    blurb: "White ink on blueprint blue, with a drawing grid.",
  },
  {
    id: "synthwave",
    word: "neon",
    label: "Neon Horizon",
    kind: "skin",
    skin: "synthwave",
    hint: "1985, a chrome sun setting over a purple grid.",
    blurb: "Magenta and violet with a glowing horizon.",
  },
  {
    id: "parchment",
    word: "scroll",
    label: "Old Parchment",
    kind: "skin",
    skin: "parchment",
    hint: "Ink on something older than paper.",
    blurb: "Sepia pages and serif type.",
  },
  {
    id: "crt",
    word: "scanline",
    label: "Scanlines",
    kind: "crt",
    hint: "The tube's thin stripes, still there if you squint.",
    blurb: "Faint CRT scanlines and a soft vignette over everything.",
  },
  {
    id: "pixelfont",
    word: "pixel",
    label: "Pixel type",
    kind: "pixelFont",
    hint: "Every letter drawn square by square.",
    blurb: "All text set in the pixel font.",
  },
  {
    id: "live",
    word: "diorama",
    label: "Live scenery",
    kind: "live",
    hint: "The garden behind glass, alive behind the page.",
    blurb: "The garden's scene moves quietly behind the app, dimmed so text stays clear.",
  },
];

export const secretForWord = (word: string): Secret | undefined =>
  SECRETS.find((s) => s.word === word.trim().toLowerCase());
