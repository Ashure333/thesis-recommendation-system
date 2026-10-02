/* ============================================================
   CHANGELOG — single source of truth for recent changes.
   The Changelog tab renders these entries, and both wikis
   (Walkthrough & Engine) cite them by id via WikiCite, so a
   change gets one id here and one citation per wiki.

   `body` is the one-line summary shown on the card. `details`
   holds the engineering specifics (files, functions, the actual
   math) and stays collapsed until the reader opens the entry.
   Entries without `details` are one-liners and render no toggle.
   ============================================================ */

export type ChangeTag = "NEW" | "FIXED" | "ENHANCED";

export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  body: string;
  details?: string[];
  tag: ChangeTag;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "library-batch-export",
    date: "Oct 2",
    title: "Batch export from My Library",
    tag: "NEW",
    body:
      "Tick any papers in My Library and export them together as " +
      "one BibTeX, RIS, EndNote, or Reference Manager file.",
    details: [
      "Selection counts against the live list, so a paper the pet just ate never shows up as selected; Select all toggles the whole library and Clear drops the tick.",
      "papersToCitation joins every record with a blank line — the layout all four formats expect — and downloadCitations saves it as res-search-library-N-papers.ext.",
      "The Export menu mirrors the viewer's dropdown: outside click closes it, and the button stays disabled (with a hint) until at least one row is ticked.",
    ],
  },
  {
    id: "per-form-disposal",
    date: "Oct 2",
    title: "Each character disposes of papers its own way",
    tag: "ENHANCED",
    body:
      "Thrown crumpled papers are no longer destroyed at random: only " +
      "the slime forms eat them, and every other character answers " +
      "with a power from its own role.",
    details: [
      "FORM_DROP_MODES in petlines.ts maps each form to its drop mode: Original and Rimuru eat, Gojo zaps with Cursed Techniques (Blue, Red, Hollow Purple), Glaucira burns with Storm Breath, Crimson Blossom burns with Black Flame, Wangcai zaps with Thunderbolt, Sion, Yinyue Fox, and Kabi crumple, Ciel zaps with Annihilation, and Mashiro Rima punches it flat.",
      "Hover and reaction lines are per form too (FORM_HUNGRY_LINES, FORM_DROP_LINES), so a non-slime pet never says Gimme! or Gluttony! — the slime forms keep the shared gluttonous pools.",
      "The pet body now plays the power animation on a paper drop (it only played for search/upload/delete events before), so the character visibly casts rather than only the paper chip reacting.",
      "App-event reactions (search zaps, uploads eat, deletions burn) keep their shared per-mode pools when the form has no drop line for that mode.",
    ],
  },
  {
    id: "drag-ghost",
    date: "Oct 2",
    title: "Crumpled-paper drag ghost",
    tag: "NEW",
    body:
      "Every library row now drags as a crumpled paper ball instead of " +
      "the browser's default icon.",
    details: [
      "The ghost reuses the pet's own crumple graphic (CrumpledPaper) at a 96x96 data URL, so a dragged paper looks discarded before you drop it on the pet.",
      "Chromium ignores a canvas passed to setDragImage, and ignores an <img> that is not in the document, which is what pushed the drag back to the default icon. MyLibrary now pins a decoded <img> to the DOM at left:-10000px for the duration of the drag and removes it 1000ms after dragstart.",
      "Killed the per-form DRAG_RADII table: ten silhouette variants had to stay in sync with the sprite sheets by hand.",
    ],
  },
  {
    id: "pet-resize",
    date: "Oct 2",
    title: "SIZE slider resizes the sprite",
    tag: "FIXED",
    body:
      "The slider moved an invisible box while the sprite stayed pinned at " +
      "48px. Sprites, shadow, rings, docking, and drag bounds all track " +
      "the real footprint now.",
    details: [
      "PixelPet passed a hardcoded size={48} to PetBlob, so nothing scaled. It now passes petSize, and the sprite holds the sheet's native 192:208 ratio across the whole range.",
      "A stale PET_SIZE = 64 fed the dock clamp, the drag clamp, the tooltip flip, and the speech-bubble flip. A 208px pet could be docked or dragged half off-screen. Replaced with petBox(size) = size * 1.2.",
      "readPetPos clamped saved offsets against the old 64, so a large pet reloaded off-screen. It now takes the size, and the size state initializes before position so the footprint is known on the first read.",
      "handlePetSizeChange re-clamps and persists the position; before, growing the pet while it sat in a corner locked in an offset that no longer fit.",
      "The drop shadow and both rings (hungry + charge) were fixed-pixel SVGs that detached from the sprite. They now scale with petSize.",
      "Verified in Chromium at 48/104/208px: sprite spans 44 to 192px wide, BR and TL docks stay fully onscreen, and position survives reload.",
    ],
  },
  {
    id: "petdex-actions",
    date: "Oct 1",
    title: "The pet walks, waves, and jumps",
    tag: "NEW",
    body:
      "Forms animate from the atlas now: idle, walk, run, jump, and wave, " +
      "each facing the direction the pet last moved.",
    details: [
      "Wave/run/jump read row offsets off the Petdex sheet layout, with a per-sheet run-row fix since the sheets disagree on where their loops start.",
      "The direction derives from the last drag or walk delta, so the sprite faces the side it is leaving from.",
      "Form palettes and per-form talk lines moved into petForms and petlines so the eleven Tempest forms share one data source.",
    ],
  },
  {
    id: "drag-delete-ring",
    date: "Oct 1",
    title: "Drag-delete boundary ring",
    tag: "ENHANCED",
    body:
      "Dragging a paper over the pet lights a translucent, dashed ring " +
      "that marches around it, so the drop zone is obvious while a " +
      "library paper is in flight.",
    details: [
      "The ring is the pet's own footprint, so it widens with the SIZE slider rather than sitting at a fixed radius.",
    ],
  },
  {
    id: "locked-ephemeral",
    date: "Oct 1",
    title: "Locked pet keeps its promise",
    tag: "FIXED",
    body:
      "With the CHAT toggle locked, the pet and logo revert to the " +
      "Original form automatically. Unlock sessions stay ephemeral: " +
      "hovering tips, clicking, asking, and collecting during free " +
      "access never write real progress.",
    details: [
      "Locking restores the exact pre-unlock form and position, so a locked pet cannot end up stuck on a form you never chose.",
    ],
  },
  {
    id: "pipeline-trace",
    date: "Oct 1",
    title: "Pipeline execution trace",
    tag: "NEW",
    body:
      "The engine walkthrough now runs a real search with a recorder " +
      "attached, so the pseudocode next to it fills with that search's " +
      "actual intermediate values.",
    details: [
      "trace_service.py reruns search_papers with a recorder bolted on, capturing the configured weights, the prepared query text, the candidate set, and every component's per-candidate score.",
      "You see the raw TF-IDF and S-BERT cosine similarities, the metadata signal (already 0-1, so it skips normalization), the min-max bounds each component was rescaled against, and the weighted sum S(d) per paper.",
      "Ties print their tie-break by recency, so the final ordering is explained rather than asserted.",
    ],
  },
  {
    id: "independence-weight",
    date: "Oct 1",
    title: "Independence-weighted battle consensus",
    tag: "NEW",
    body:
      "Arena battles no longer treat six pipelines as six independent " +
      "judges. Each vote is weighted by how much evidence the voter " +
      "shares with the pipelines it agrees with.",
    details: [
      "A TF-IDF/SBERT hybrid and its two parent pipelines share most of their evidence, so a plain consensus tally counted one idea three times.",
      "compare_service.py scores each vote by independence(P, Q) = 1 - Jaccard of the two pipelines' component sets. A pipeline voting alongside its own parent carries almost no weight.",
      "Pipelines with no shared components score highest, which makes a clean hybrid-versus-precursor comparison mean something.",
      "Arena shows per-pipeline ranks and average consensus rank next to the winner.",
    ],
  },
  {
    id: "web-battles",
    date: "Oct 1",
    title: "Web battles in the Arena and Lab",
    tag: "NEW",
    body:
      "Arena and Lab gained a Repository/Web scope switcher. Web " +
      "battles vectorize live OpenAlex, Crossref, and arXiv hits with " +
      "the same stored TF-IDF vectorizer and S-BERT model the repository " +
      "search uses.",
    details: [
      "Web hits never touch the battle tally; a web scope compares rankings, it does not award points.",
      "OpenAlex rate-limit retries cap at 8 seconds instead of stalling for minutes.",
      "Web battles embed every hit in one batched S-BERT pass rather than one call per paper.",
    ],
  },
  {
    id: "similar-graph",
    date: "Oct 1",
    title: "Similar-papers graph",
    tag: "NEW",
    body:
      "Each paper grew a Connected-Papers-style graph: weighted edges, " +
      "shortest weighted paths from the origin, and the authors and " +
      "topics the graph shares.",
    details: [
      "connected_graph.py follows the connectedpapers-js model: weighted sparse edges, path_lengths, node_paths, and common_authors/common_topics for anything shared by two or more graph papers.",
      "Edge weight blends the selected pipeline's own components, so the graph cannot contradict the ranking it sits next to.",
      "The reference model derives common references from bibliographic coupling and co-citation. This repo stores no reference lists, so shared keywords and subject/category stand in. That is a deliberate substitution, not a claim of equivalence.",
    ],
  },
  {
    id: "identifier-resolver",
    date: "Oct 1",
    title: "DOI and arXiv resolution",
    tag: "NEW",
    body:
      "Uploads resolve their own identifiers instead of landing unlabeled " +
      "and getting force-fit by the keyword classifier later.",
    details: [
      "identifier_resolver.py handles DOI, arXiv ID, and PDF metadata in one pass, so an import arrives classified rather than empty.",
    ],
  },
  {
    id: "arxiv-taxonomy",
    date: "Oct 1",
    title: "arXiv categories map into the taxonomy",
    tag: "NEW",
    body:
      "arXiv papers carry category codes like cs.LG. Those codes now " +
      "resolve to a real subject and category on import.",
    details: [
      "arxiv_categories.py maps codes onto the repository's taxonomy. A code with no good existing slot creates a new category under the matching subject, following the same taxonomy-grows rule as the classifier's broad fallback.",
      "Unknown codes map to nothing, and the text classifier gets its normal turn.",
    ],
  },
  {
    id: "citation-export",
    date: "Oct 1",
    title: "Citation export",
    tag: "NEW",
    body:
      "Papers export as BibTeX, RIS, EndNote, or RefMan from the " +
      "viewer and the upload flow.",
    details: [
      "exportCitations.ts emits all four formats, with a BibTeX PDF preview on the import side.",
    ],
  },
  {
    id: "hybrid-pipelines",
    date: "Oct 1",
    title: "Six scoring pipelines",
    tag: "NEW",
    body:
      "Search runs through one of six pipelines, from TF-IDF alone to " +
      "the full TF-IDF + S-BERT + metadata blend, with tunable weights.",
    details: [
      "pipeline_config.py defines tfidf, sbert, tfidf_sbert, tfidf_metadata, sbert_metadata, and tfidf_sbert_metadata. The hybrids ship with preset weights (0.50/0.50, 0.667/0.333, and so on) that you can redial in the Lab.",
      "Components are min-max normalized before the weighted sum, except metadata, which is already 0-1. Ranking is S(d) descending, tie-broken by recency.",
    ],
  },
  {
    id: "petdex-sprites",
    date: "Sep 30",
    title: "Real Petdex sprites",
    tag: "NEW",
    body:
      "The pet renders its eleven forms from actual sprite sheets on a " +
      "canvas, with the procedural Original blob kept alongside.",
    details: [
      "idle animation loop, ink outline, and per-form palettes all come off the sheet; Original stays procedural so it can recolor with the theme.",
    ],
  },
  {
    id: "hover-dwell",
    date: "Sep 30",
    title: "Faster tip reveals",
    tag: "ENHANCED",
    body:
      "Hover dwell dropped to 2.5 seconds with a shorter cooldown, so " +
      "tips surface quicker without losing the scavenger-hunt feel.",
  },
  {
    id: "battle-records",
    date: "Sep 29",
    title: "Battle records",
    tag: "ENHANCED",
    body:
      "Arena battle history gained pagination and a win tally, and Lab " +
      "recipes can battle as a custom pipeline with dial weights instead " +
      "of the fixed presets.",
    details: [
      "Pagination and the tally are computed server-side, so the history stays honest as the table grows.",
    ],
  },
  {
    id: "lab",
    date: "Sep 28",
    title: "The Lab opens",
    tag: "NEW",
    body:
      "A recipe workshop: mix TF-IDF, S-BERT, and metadata " +
      "percentages into your own algorithm, simulate battles against " +
      "the six presets, and climb the leaderboard.",
    details: [
      "PipelineDials sets the three weights live; the Lab runs the same search_service path the real API uses, so a recipe that wins here wins in the repository.",
    ],
  },
  {
    id: "typography",
    date: "Sep 28",
    title: "Typographic tune-up",
    tag: "ENHANCED",
    body:
      "Pixelify Sans standardized across the interface, with a prose " +
      "pass over every label and message.",
    details: [
      "Also killed the ticker text overflow that let long messages smear past their track.",
    ],
  },
];
