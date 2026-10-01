/* ============================================================
   CHANGELOG — single source of truth for recent changes.
   The Changelog tab renders these entries, and both wikis
   (Walkthrough & Engine) cite them by id via WikiCite, so a
   change gets one id here and one citation per wiki.
   ============================================================ */

export type ChangeTag = "NEW" | "FIXED" | "ENHANCED";

export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  body: string;
  tag: ChangeTag;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "drag-delete-ring",
    date: "Oct 1",
    title: "Drag-delete boundary ring",
    tag: "ENHANCED",
    body:
      "Dragging a paper over the pet now lights a translucent, " +
      "dashed ring that marches around it — the drop zone is " +
      "clearly marked while a library paper is in flight.",
  },
  {
    id: "locked-ephemeral",
    date: "Oct 1",
    title: "Locked pet keeps its promise",
    tag: "FIXED",
    body:
      "With the CHAT toggle locked, the pet and logo now revert to " +
      "the Original form automatically. Unlock sessions are " +
      "ephemeral: hovering tips, clicking, asking, and collecting " +
      "during free access never write real progress — locking " +
      "restores the exact pre-unlock state.",
  },
  {
    id: "web-battles",
    date: "Oct 1",
    title: "Web battles in the Arena and Lab",
    tag: "NEW",
    body:
      "Both the Arena and the Lab gained a Repository/Web scope " +
      "switcher. Web battles vectorize live OpenAlex, Crossref, and " +
      "arXiv hits on the fly with the same stored TF-IDF vectorizer " +
      "and S-BERT model, and never touch the battle tally.",
  },
  {
    id: "petdex-sprites",
    date: "Sep 30",
    title: "Real Petdex sprites",
    tag: "NEW",
    body:
      "The pet now renders its eleven forms from actual sprite " +
      "sheets on a canvas — idle animation loop, ink outline, and " +
      "the procedural Original blob included.",
  },
  {
    id: "hover-dwell",
    date: "Sep 30",
    title: "Faster tip reveals",
    tag: "ENHANCED",
    body:
      "The hover dwell was lowered to 2.5 seconds with a shorter " +
      "cooldown, so tips surface quicker without giving up the " +
      "scavenger-hunt feel.",
  },
  {
    id: "openalex-backoff",
    date: "Sep 30",
    title: "Resilient web search",
    tag: "FIXED",
    body:
      "OpenAlex rate-limit retries were capped at 8 seconds instead " +
      "of stalling for minutes, and web battles now embed all hits " +
      "in one batched S-BERT pass.",
  },
  {
    id: "arxiv-source",
    date: "Sep 29",
    title: "arXiv joins the web search",
    tag: "NEW",
    body:
      "A third scholarly source with its own category mapping, " +
      "normalized and deduplicated alongside OpenAlex and Crossref.",
  },
  {
    id: "battle-records",
    date: "Sep 29",
    title: "Battle records",
    tag: "ENHANCED",
    body:
      "Arena battle history gained pagination and a win tally, and " +
      "Lab recipes can battle as a custom pipeline with dial " +
      "weights instead of the fixed presets.",
  },
  {
    id: "lab",
    date: "Sep 28",
    title: "The Lab opens",
    tag: "NEW",
    body:
      "A recipe workshop: mix TF-IDF, S-BERT, and metadata " +
      "percentages into your own algorithm, simulate battles " +
      "against the six presets, and climb the leaderboard.",
  },
  {
    id: "typography",
    date: "Sep 28",
    title: "Typographic tune-up",
    tag: "ENHANCED",
    body:
      "Pixelify Sans standardized across the interface, with a " +
      "prose pass to keep every label and message crisp.",
  },
  {
    id: "thesis",
    date: "Sep 27",
    title: "The thesis is written",
    tag: "NEW",
    body:
      "Chapters 1–3, appendices, and review rounds for the BulSU " +
      "BSMCS thesis proposal — compiled to DOCX and PDF.",
  },
];
