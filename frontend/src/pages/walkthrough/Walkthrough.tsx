import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseX } from "../../components/retro/PixelIcons";
import {
  Chip,
  WikiCite,
  WikiFooter,
  WikiHeader,
  WikiInfobox,
  WikiNav,
  WikiSection,
  WikiSub,
  WikiTable,
} from "./wiki";

/* ============================================================
   WALKTHROUGH, an encyclopedia-style manual for the whole
   Re:Search system, laid out like a Bulbapedia walkthrough:
   sticky table of contents on the left, an infobox up top,
   heavily sectioned content, and detailed tables everywhere.
   Temporary tab: hide it by flipping SHOW_WALKTHROUGH_TAB in
   AppLayout.tsx to false.
   ============================================================ */

const CODED_NAMES = [
  ["PIXEL PUNCH", "TF-IDF", "Lexical only"],
  ["GHOST WIRE", "S-BERT", "Semantic only"],
  ["DUO MODE", "TF-IDF + S-BERT", "Lexical + semantic"],
  ["TRIVIA QUEST", "TF-IDF + Metadata", "Lexical + metadata"],
  ["ARCHIVE MAGE", "S-BERT + Metadata", "Semantic + metadata"],
  ["FINAL BOSS", "TF-IDF + S-BERT + Metadata", "Full hybrid"],
] as const;

const TREASURES = [
  ["hunt-coin", "Golden Coin", "Login", "bottom-left of the Login page"],
  ["hunt-cassette", "Cassette", "Recommendations", "right edge of Recommendations"],
  ["hunt-orb", "Glowing Orb", "Repository", "top-right of the Repository page"],
  ["hunt-cartridge", "Game Cartridge", "Upload", "lower-right of the Upload page"],
  ["hunt-star", "Star Shard", "My Library", "lower-left of My Library"],
  ["hunt-key", "Golden Key", "Arena", "left edge of the Arena page"],
] as const;

const ACHIEVEMENTS = [
  ["first-tip", "First Contact", "Discover your first tip"],
  ["tip-collector", "Tip Collector", "Discover 5 tips"],
  ["tip-master", "Tip Master", "Discover every tip (26/26)"],
  ["first-treasure", "Treasure Hunter", "Collect your first treasure"],
  ["treasure-hunter", "Treasure Hoarder", "Collect 3 treasures"],
  ["hunt-complete", "Hunt Complete", "Collect all 6 treasures"],
  ["petting-zoo", "Petting Zoo", "Pet the companion 10 times"],
  ["traveler", "Traveler", "Drag the companion"],
  ["question-master", "Question Master", "Ask the help library 3 questions"],
] as const;

const ENDPOINTS = [
  ["GET", "/api/papers", "List, search, filter, and sort papers"],
  ["GET", "/api/papers/stats", "Repository statistics"],
  ["POST", "/api/papers/upload", "Upload a PDF or BibTeX file"],
  ["POST", "/api/papers/import-url", "Import from a Google Scholar BibTeX URL"],
  ["POST", "/api/papers/import-bibtex", "Import a pasted BibTeX citation"],
  ["PATCH", "/api/papers/{id}", "Update paper metadata"],
  ["DELETE", "/api/papers/{id}", "Delete a paper"],
  ["GET", "/api/papers/{id}/pdf", "View the stored PDF"],
  ["GET", "/api/papers/{id}/find-pdf", "Search for open-access PDF candidates"],
  ["POST", "/api/papers/{id}/attach-pdf", "Download and attach a chosen PDF"],
  ["GET", "/api/papers/{id}/similar-graph", "Build the similar-papers graph"],
  ["GET", "/api/recommendations", "Get ranked recommendations"],
  ["GET", "/api/recommendations/trace", "Real-time math trace of one search"],
  ["POST", "/api/recommendations/compare", "Arena battle: all six pipelines at once"],
  ["POST", "/api/recommendations/web-compare", "Web battle: all six pipelines over live web hits"],
  ["GET", "/api/recommendations/status", "Check if the index is stale"],
  ["POST", "/api/recommendations/rebuild", "Rebuild vectors and embeddings"],
  ["GET", "/api/search-web", "Search OpenAlex, Crossref, and arXiv"],
  ["GET", "/api/evaluation/battles", "Battle history for the Arena tally"],
  ["GET", "/api/library", "The personal library"],
  ["POST", "/api/library/{id}", "Save a paper"],
  ["DELETE", "/api/library/{id}", "Remove a paper"],
  ["POST", "/api/research-chat", "Ask the research assistant"],
] as const;

const SUBJECTS = [
  ["Computer Science: Machine Learning", "100"],
  ["Mathematics: Mathematical Analysis", "20"],
  ["Mathematics: Mathematical Modeling", "15"],
  ["Mathematics: Graph Theory", "13"],
  ["Mathematics: Linear Algebra", "10"],
  ["(unclassified)", "6"],
  ["Computer Science: Information Retrieval", "3"],
  ["Computer Science: Algorithms", "1"],
] as const;

const INFOBOX_ROWS: [string, string][] = [
  ["Name", "Re:Search"],
  ["Type", "Academic paper repository + recommendation system"],
  ["Developer", "TEMPEST · BSMCS thesis project at Bulacan State University"],
  ["Tech", "FastAPI · SQLAlchemy · SQLite · scikit-learn · sentence-transformers · React · TypeScript · Vite · Tailwind"],
  ["Models", "TF-IDF (scikit-learn) · S-BERT (all-MiniLM-L6-v2)"],
  ["Pipelines", "6 fixed configurations + 1 custom dial"],
  ["Pages", "Recommendations · Repository · Upload · My Library · Arena · Lab · Walkthrough · Engine · FAQ · Changelog"],
  ["Extra", "Pixel pet · scavenger hunt · achievements · research assistant"],
  ["Status", "Local research prototype"],
];

const TOC = [
  ["overview", "Overview"],
  ["getting-started", "Getting started"],
  ["recommendations", "Walkthrough: Recommendations"],
  ["repository", "Walkthrough: Repository"],
  ["upload", "Walkthrough: Upload"],
  ["my-library", "Walkthrough: My Library"],
  ["arena", "Walkthrough: Arena"],
  ["pet", "The pixel pet & scavenger hunt"],
  ["garden", "The Garden & Tree of Knowledge"],
  ["engine", "The recommendation engine"],
  ["api", "Data & API reference"],
  ["screenshots", "Screenshots"],
  ["trivia", "Tips & trivia"],
] as const;

const OTHER_PAGES = [
  ["/recommendations", "Search"],
  ["/repository", "Repository"],
  ["/upload", "Upload"],
  ["/library", "My Library"],
  ["/evaluation", "Arena"],
  ["/walkthrough-engine", "Engine"],
  ["/faq", "FAQ"],
  ["/changelog", "Changelog"],
] as const;

const FORMS = [
  ["original", "Original", "The pet's first face: a theme-accent slime blob, before the Petdex companions arrived.", "Code-rendered blob"],
  ["rimuru", "Rimuru", "TenSura's Rimuru Tempest — a salaryman reborn as a slime who devoured his way to demon-lordhood.", "Petdex Rimuru sheet"],
  ["veldora", "Glaucira", "Stands in for Veldora, the Storm Dragon sealed inside Rimuru — and later his rowdiest friend.", "Petdex Glaucira dragon sheet"],
  ["benimaru", "Crimson Blossom", "Stands in for Benimaru, the kijin general of Tempest — crimson flames, twin horns, blooming loyalty.", "Petdex crimson-blossom sheet"],
  ["shion", "Sion", "Stands in for Shion, the demon secretary of Tempest — violet hair, a single horn, a gentle face.", "Petdex sioning sheet"],
  ["ranga", "Wangcai", "Stands in for Ranga, the Tempest Wolf — Rimuru's first named summon, white fur and blue eyes.", "Petdex Wangcai cat sheet"],
  ["shuna", "Yinyue Fox", "Stands in for Shuna, the gentle priestess of Tempest — pink hair, fox ears, a healing heart.", "Petdex yinyue fox sheet"],
  ["gobta", "Kabi", "Stands in for Gobta, Tempest's goblin lieutenant — apple habit borrowed from Snorlax (卡比兽).", "Petdex Kabi sheet"],
  ["ciel", "Ciel", "TenSura's Ciel — the personified Great Sage, Rimuru's ultimate intelligence skill.", "Petdex Ciel sheet"],
  ["diablo", "Gojo", "Jujutsu Kaisen's Gojo Satoru — the strongest sorcerer: blindfolded, limitless, Ryoiki Tenkai.", "Petdex Gojo sheet"],
  ["milim", "Mashiro Rima", "Stands in for Milim Nava, the Destroyer — a dragon-girl demon lord who'd rather play; now she performs.", "Petdex Mashiro Rima sheet"],
] as const;

const GALLERY = [
  ["01-login.png", "Login", "Single-user local sign-in; any email and password works.", "overview"],
  ["10-login-splash.png", "Title screen", "The arcade splash: INSERT COIN TO CONTINUE before the app opens.", "overview"],
  ["11-settings.png", "Settings", "Theme accent picker, pet visibility, and the site-mode switches.", "overview"],
  ["02-recommendations.png", "Search", "Query bar, mode tabs, ranked results, and the similar-papers graph.", "search"],
  ["12-search-details.png", "Search: details pane", "Any result opens a detail pane with score contributions and actions.", "search"],
  ["13-search-modes.png", "Search: mode tabs", "Switch between the six pipelined modes without losing the query.", "search"],
  ["14-search-lower.png", "Search: lower results", "The ranked list continues with pagination and per-row tools.", "search"],
  ["03-repository.png", "Repository", "Browse with sidebar filters, sorting, and per-row actions.", "repository"],
  ["15-repository-filters.png", "Repository: filters", "Sidebar filters narrow the corpus by year, venue, and signals.", "repository"],
  ["16-repository-lower.png", "Repository: deep list", "The full list scrolls; every row carries its own actions.", "repository"],
  ["04-upload.png", "Upload", "Add by identifier with an arXiv record resolved into the review form.", "upload"],
  ["17-upload-lower.png", "Upload: review form", "Parsed metadata lands in the review form for correction before saving.", "upload"],
  ["18-upload-bottom.png", "Upload: import paths", "PDF, BibTeX paste, and URL import all feed the same repository.", "upload"],
  ["05-library.png", "My Library", "Saved papers, Find Similar, and drag-to-pet disposal.", "my-library"],
  ["19-library-lower.png", "My Library: actions", "Find Similar, PDF actions, and removal all live on the card.", "my-library"],
  ["33-library-mid.png", "My Library: selection", "Selecting a paper opens its detail view beside the list.", "my-library"],
  ["06-arena.png", "Arena", "A battle run: winner banner, consensus ranking, and pairwise agreement.", "arena"],
  ["20-arena-lower.png", "Arena: rankings", "The consensus table ranks all six pipelines for the run.", "arena"],
  ["21-arena-bottom.png", "Arena: history", "Battle history powers the long-term tally across runs.", "arena"],
  ["07-pet.png", "The pixel pet", "The resident companion, mid-speech above the Arena.", "pet"],
  ["08-pet-forms.png", "Pet forms", "The ten Tempest forms the slime shifts into, each in the character's own palette.", "pet"],
  ["09-pet-speech.png", "Pet speech", "The second voice: Japanese lines always carry their translation.", "pet"],
  ["25-pet-menu.png", "Pet menu", "Right-click the pet for its menu: hunt, tips, chat, and RESET.", "pet"],
  ["26-garden-seedling.png", "Garden: seedling", "A young tree in the meadow, stage chips along the top-left.", "garden"],
  ["27-garden-mature.png", "Garden: mature", "The canopy at full spread; the milestone chips mark the march.", "garden"],
  ["28-garden-ancient.png", "Garden: ancient", "The ancient crown rising through the haze at 1,000 ft.", "garden"],
  ["29-garden-themes.png", "Theme shop", "Seven backdrop scenes adopted with growth tokens.", "garden"],
  ["30-garden-cheats.png", "Cheat ladder", "Each species keeps three cheat words with their effects.", "garden"],
  ["31-garden-climb.png", "Climbing the tree", "Zoomed in, the arrows and drag walk you up the trunk.", "garden"],
  ["32-engine.png", "Engine walkthrough", "The engine page documents every pipeline's math end to end.", "engine"],
  ["34-engine-lower.png", "Engine: components", "Component maths: lexical, semantic, and metadata signals.", "engine"],
  ["35-engine-bottom.png", "Engine: evaluation", "How the harness scores and compares the six pipelines.", "engine"],
] as const;

const TOPIC_LABELS: Record<string, string> = {
  overview: "Overview",
  search: "Search",
  repository: "Repository",
  upload: "Upload",
  "my-library": "My Library",
  arena: "Arena",
  pet: "The pixel pet",
  garden: "The Garden",
  engine: "The engine",
};

function TopicShots({
  topic,
  open,
}: {
  topic: string;
  open: (index: number, el: HTMLElement | null) => void;
}) {
  const items = GALLERY.map((entry, index) => ({ entry, index })).filter(
    ({ entry }) => entry[3] === topic,
  );
  if (items.length === 0) return null;
  return (
    <div className="mt-4 border-t-[3px] border-gray-900 pt-3">
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
        {TOPIC_LABELS[topic] ?? topic} · {items.length} screenshots
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(({ entry, index }) => {
          const [src, title, caption] = entry;
          return (
            <figure
              key={src}
              className="group overflow-hidden rounded border-[3px] border-gray-900 bg-white"
            >
              <button
                type="button"
                onClick={(event) => open(index, event.currentTarget)}
                aria-label={`Preview ${title}`}
                title="Click to preview"
                className="block w-full cursor-zoom-in border-b-[3px] border-gray-900 transition-colors pixel-ease focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-gray-900 group-hover:bg-accentSoft"
              >
                <img
                  src={`/walkthrough/${src}`}
                  alt={title}
                  loading="lazy"
                  className="block w-full"
                />
              </button>
              <figcaption className="p-2.5">
                <p className="font-pixelify text-xs font-bold text-ink">
                  {title}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-muted">
                  {caption}
                </p>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

export default function Walkthrough() {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  /* The clicked image's spot in the CURRENT scroll, so the pop-up
     spawns right there (viewport coordinates) instead of popping
     into the middle of nowhere. */
  const [previewOrigin, setPreviewOrigin] = useState<{
    cx: number;
    cy: number;
  } | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  function openPreview(index: number, el?: HTMLElement | null) {
    const rect = el?.getBoundingClientRect();
    if (rect && el) {
      triggerRef.current = el;
      setPreviewOrigin({
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
      });
    }
    setPreviewIndex(index);
  }

  function closePreview() {
    const trigger = triggerRef.current;
    setPreviewIndex(null);
    setPreviewOrigin(null);
    triggerRef.current = null;
    /* Focus goes back exactly where the preview came from, after
       the pop-up unmounts. */
    window.setTimeout(() => trigger?.focus(), 0);
  }

  function stepPreview(delta: number) {
    setPreviewIndex((current) => {
      if (current === null) return current;
      return (current + delta + GALLERY.length) % GALLERY.length;
    });
  }

  useEffect(() => {
    if (previewIndex === null) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePreview();
      } else if (event.key === "ArrowRight") {
        stepPreview(1);
      } else if (event.key === "ArrowLeft") {
        stepPreview(-1);
      } else if (event.key === "Tab") {
        /* Persistent focus: Tab cycles the pop-up's own controls
           and can never wander into the page behind it. */
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusables = Array.from(
          dialog.querySelectorAll<HTMLElement>("button"),
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    /* Focus lands inside the pop-up the instant it appears... */
    const seat = window.setTimeout(() => {
      dialogRef.current?.focus();
    }, 0);
    /* ...and the page behind it holds still. */
    const block = (event: Event) => event.preventDefault();
    const keepFocus = () => {
      const dialog = dialogRef.current;
      if (dialog && !dialog.contains(document.activeElement)) {
        dialog.focus();
      }
    };
    /* Blur-redirecting too: once seated, focus can never leave. */
    const onFocusOut = () => window.setTimeout(keepFocus, 0);
    window.addEventListener("wheel", block, { passive: false });
    window.addEventListener("touchmove", block, { passive: false });
    document.addEventListener("focusin", keepFocus);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(seat);
      window.removeEventListener("wheel", block);
      window.removeEventListener("touchmove", block);
      document.removeEventListener("focusin", keepFocus);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewIndex]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
      <WikiHeader
        eyebrow="MANUAL · ENCYCLOPEDIA-STYLE"
        title="Walkthrough of the Re:Search system"
        description="A page-by-page guide to every feature of the prototype: the repository, the six recommendation pipelines, the similar-papers graph, the Arena, and the resident pixel pet, detailed the way a walkthrough documents a game world."
        categories={["Category: Re:Search", "Category: Documentation", "Category: Walkthrough"]}
      />

      {/* ------------------------------------------------ BODY GRID */}
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* ================= TOC (left rail) ================= */}
        <WikiNav toc={TOC} otherPages={OTHER_PAGES} />

        {/* ================= CONTENT (right column) ================= */}
        <div className="min-w-0 flex-1 space-y-10">
          {/* ---- infobox + overview ---- */}
          <div className="grid gap-6 md:grid-cols-5">
            <div className="md:col-span-3">
              <WikiSection id="overview" title="Overview">
                <p className="text-sm leading-6 text-ink">
                  Re:Search is a local academic paper repository and
                  recommendation system built as a thesis prototype. It
                  stores papers imported from PDFs or BibTeX citations,
                  validates them for recommendation use, represents each
                  one with a lexical vector (TF-IDF) and a semantic
                  embedding (S-BERT), and recommends related literature
                  through six fixed pipeline configurations and a
                  user-customizable dial. A seventh page, the Arena,
                  runs all six pipelines against the same query and
                  compares them side by side.
                </p>
                <p className="text-sm leading-6 text-ink">
                  The system speaks an arcade language on top of that
                  machinery: pipelines carry codenames, a pixel pet
                  explains the interface, six treasures are hidden
                  across the pages, and a scavenger-hunt completion
                  unlocks the pet's full help library. This walkthrough
                  documents both layers, page by page.
                </p>
              </WikiSection>
            </div>
            <div className="md:col-span-2">
              <p className="mb-2 font-mono text-xs font-bold tracking-[0.2em] text-accent">
                RE:SEARCH INFO
              </p>
              <WikiInfobox rows={INFOBOX_ROWS} />
            </div>
          </div>

          <WikiSection id="getting-started" title="Getting started">
            <WikiSub id="sign-in" title="Signing in">
              <p className="text-sm leading-6 text-ink">
                The prototype runs in a single-user local mode. The sign-in
                form accepts any well-formed email and any password. There
                is no real authentication; the choice is remembered in this
                browser. Everything after sign-in shares the top navigation.
              </p>
            </WikiSub>
            <WikiSub id="nav" title="The top navigation">
              <p className="text-sm leading-6 text-ink">
                Six tabs lead the way: <Chip>Search</Chip> (the
                Recommendations page), <Chip>Repository</Chip>,{" "}
                <Chip>Upload</Chip>, <Chip>My Library</Chip>,{" "}
                <Chip>Arena</Chip>, and this walkthrough. The right side of
                the bar shows the active pipeline's codename and a theme
                color picker.
              </p>
              <p className="text-sm leading-6 text-ink">
                Tip: hover any tab (or any labeled control) and hold the
                pointer still. The pixel pet dwells for 2.5 seconds and
                then explains what that element does.
              </p>
            </WikiSub>
            <TopicShots topic="overview" open={openPreview} />
          </WikiSection>

          <WikiSection id="recommendations" title="Walkthrough: Recommendations">
            <p className="text-sm leading-6 text-ink">
              The Recommendations page is the heart of the system: a query
              bar, a mode switch, a pipeline selector with custom dials,
              ranked results, a similar-papers graph, and a live math trace.
            </p>

            <WikiTable
              headers={["Feature", "What it does"]}
              rows={[
                [
                  "Query bar + depth",
                  "Enter free text (e.g. \"neural network text similarity\") and pick a depth of Top 5 / Top 10 / Top 15.",
                ],
                [
                  "Mode switch",
                  "Query mode searches from text; seed-paper mode searches from a chosen repository paper (the seed is excluded from its own results).",
                ],
                [
                  "Pipeline selector",
                  "Six presets plus a custom dial mode. The chip in the top bar shows the active codename.",
                ],
                [
                  "Custom dials",
                  "Three dials (TF-IDF, S-BERT, Metadata) whose values are normalized so the weights sum to 1. An all-zero dial falls back to an equal split.",
                ],
                [
                  "Results table",
                  "Rank, title, year, and score per result; the score is a similarity value, not a percentage. Clicking a rank badge re-centers the similar-papers graph on that paper.",
                ],
                [
                  "Similar papers graph",
                  "The top result becomes the graph center; similar papers cluster around it. Link count is adjustable (10 / 20 / 30 / 40).",
                ],
                [
                  "Pipeline math panel",
                  "A toggle shows the mathematical pseudocode of the active pipeline; the live trace fills every formula with the real numbers of the current search.",
                ],
              ]}
            />

            <WikiSub id="codename-table" title="Pipeline codenames">
              <WikiTable
                headers={["Codename", "Signals", "Composition"]}
                rows={CODED_NAMES.map(([codename, signals, composition]) => [
                  <Chip key={codename}>{codename}</Chip>,
                  signals,
                  composition,
                ])}
              />
            </WikiSub>
            <TopicShots topic="search" open={openPreview} />
          </WikiSection>

          {/* topic shots appended to the previous section */}
          <WikiSection id="repository" title="Walkthrough: Repository">
            <p className="text-sm leading-6 text-ink">
              The repository is the browse-and-manage face of the stored
              corpus. It reads the same SQLite database the recommendation
              engine uses, so everything stays in one place.
            </p>
            <WikiTable
              headers={["Feature", "What it does"]}
              rows={[
                [
                  "Sidebar filters",
                  "Text search plus subject, category, document type, and minimum/maximum publication year filters.",
                ],
                [
                  "Sorting & limits",
                  "Sort the list by various fields and cap the number of rows returned.",
                ],
                [
                  "Repository stats",
                  "A stats panel summarizes the stored corpus.",
                ],
                [
                  "Web mode",
                  "Toggle from stored papers to live search: OpenAlex, Crossref, and arXiv with a source selector, peer-reviewed and open-access filters, and relevance/citations/year sorting. Hits can be inspected in the same details pane and imported into the repository.",
                ],
                [
                  "Paper actions",
                  "View the attached PDF in a modal, edit metadata, search for an open-access PDF online, or delete the record.",
                ],
                [
                  "PDF discovery",
                  "For records without a stored file, the system queries Unpaywall, Crossref, Semantic Scholar, arXiv, and OpenAlex, and can download and attach the best candidate.",
                ],
              ]}
            />
            <WikiCite ids={["arxiv-source"]} />
            <TopicShots topic="repository" open={openPreview} />
          </WikiSection>

          <WikiSection id="upload" title="Walkthrough: Upload">
            <p className="text-sm leading-6 text-ink">
              Upload is the front door for new papers. Three import paths
              feed the same pipeline: extract metadata, classify, validate,
              generate keywords, and store the record.
            </p>
            <WikiTable
              headers={["Method", "Details"]}
              rows={[
                [
                  "PDF upload",
                  "Text and metadata are extracted with pdfplumber (heuristic; scanned PDFs without OCR may extract poorly).",
                ],
                [
                  "BibTeX import",
                  "Paste a .bib citation (or Google Scholar's BibTeX) and the fields are parsed into the record.",
                ],
                [
                  "Google Scholar URL import",
                  "Paste a scholar.googleusercontent.com BibTeX URL and it is fetched directly.",
                ],
                [
                  "Recommendation validation checklist",
                  "Title, abstract, keywords, and publication year must be present before a paper becomes recommendable; missing fields are listed.",
                ],
                [
                  "Keyword generation",
                  "Papers without keywords get them generated from title + abstract with YAKE.",
                ],
                [
                  "Duplicate rejection",
                  "An exact DOI or a title similarity of at least 0.85 blocks the upload with HTTP 409 and names the existing record.",
                ],
                [
                  "Auto PDF attach",
                  "Citation-only imports receive the best open-access PDF candidate automatically when one clears the confidence bar.",
                ],
              ]}
            />
            <TopicShots topic="upload" open={openPreview} />
          </WikiSection>

          <WikiSection id="my-library" title="Walkthrough: My Library">
            <p className="text-sm leading-6 text-ink">
              My Library is the personal shortlist. Papers can be saved
              from the Repository or from Recommendations and removed again
              at any time; the counter badge on the tab tracks the count.
            </p>
            <WikiTable
              headers={["Feature", "What it does"]}
              rows={[
                [
                  "Save / remove",
                  "One click moves a paper in or out of the library; the top-nav badge updates immediately.",
                ],
                [
                  "Find Similar",
                  "Runs the similar-papers graph with the library paper as the origin. The same graph that powers the Recommendations pane.",
                ],
              ]}
            />
            <TopicShots topic="my-library" open={openPreview} />
          </WikiSection>

          <WikiSection id="arena" title="Walkthrough: Arena">
            <p className="text-sm leading-6 text-ink">
              The Arena is the evaluation instrument: all six pipelines
              enter, one leaves. It runs every configuration on the same
              query or seed paper at a chosen depth and compares them with
              four structures.
            </p>
            <WikiTable
              headers={["Structure", "What it reports"]}
              rows={[
                [
                  "Winner banner",
                  "The pipeline that captured the largest share of independence-weighted consensus. Agreement with a rival counts only as much as that rival is built from different signals.",
                ],
                [
                  "Score distribution",
                  "One row per rank position with all six pipelines' scores scaled against the highest score.",
                ],
                [
                  "Consensus ranking",
                  "Papers ordered by how many pipelines ranked them, then by average rank.",
                ],
                [
                  "Pairwise agreement",
                  "For every pipeline pair: overlap@k (shared papers) and mean rank gap (lower = more agreement).",
                ],
                [
                  "Battle grid",
                  "Every paper's rank under every pipeline, empty cells where a paper missed the top-k.",
                ],
                [
                  "Battle records",
                  "A win tally over time, the current champion, and streaks; every run is logged to the battle history.",
                ],
                [
                  "Repository / Web scope",
                  "Switches the candidate pool between the repository and live web hits (OpenAlex, Crossref, arXiv — with per-source and open-access toggles). Web battles vectorize every hit on the fly with the stored TF-IDF vectorizer and S-BERT model; they are exploratory and never recorded to the tally.",
                ],
              ]}
            />
            <WikiCite ids={["web-battles", "battle-records"]} />
            <TopicShots topic="arena" open={openPreview} />
          </WikiSection>

          <WikiSection id="pet" title="The pixel pet & scavenger hunt">
            <p className="text-sm leading-6 text-ink">
              The pet is a clipper-style companion that explains the
              interface, runs a scavenger hunt, hands out achievements, and
              becomes a help library. It lives in the bottom-right corner,
              is draggable, and its position persists.
            </p>
            <p className="text-sm leading-6 text-ink">
              Dragging a paper onto the pet deletes it from your
              library. The pet reacts with its current form's
              animation and speech line. It leans on its inner
              Great Sage to analyze recommendations, and names
              everything it likes. It speaks a second voice —
              Japanese lines always shown with their translation —
              and each form talks in character: Gojo casts
              Ryoiki Tenkai, Kabi asks for apples, Ciel reports
              "calculation complete", and the others speak their own
              signature lines.
            </p>

            <WikiSub id="forms" title="The eleven forms">
              <WikiTable
                headers={["Form", "Lore", "Source"]}
                rows={FORMS.map(([id, name, lore, source]) => [
                  <Chip key={id}>{name}</Chip>,
                  lore,
                  source,
                ])}
              />
            </WikiSub>
            <p className="text-sm leading-6 text-ink">
              Every form plays its own real Petdex sprite sheet — a curated
              pet from the public gallery, renamed to fit the roster:
              Glaucira the blue dragon, Wangcai the calm cat, Yinyue Fox,
              Kabi the sleepy napper, Gojo the blindfolded sorcerer,
              Mashiro Rima the stage idol, and more. Sheets are 8×9 atlases
              of 192×208 frames; the idle animation loops the first six
              frames, and the canvas renders at native resolution with hard
              pixels. All forms still follow the theme and animate with the
              same bob, bounce, and reaction keyframes. The chosen form is
              remembered per browser; old selections fall back to Rimuru.
              While the CHAT toggle is locked, the pet and logo revert to
              the Original form automatically.
            </p>
            <WikiCite ids={["petdex-sprites", "locked-ephemeral"]} />
            <WikiTable
              headers={["Interaction", "What happens"]}
              rows={[
                [
                  "Hover (main way)",
                  "Hold the pointer on any element labeled with a tip; the pet dwells for 2.5 seconds (progress ring + percent chip) and reveals the tip. A 3-second cooldown rests the pet between reveals.",
                ],
                [
                  "Click",
                  "Pets the pet and cycles through discovered tips; while treasures are missing, a hint for the next one is included.",
                ],
                [
                  "Double-click",
                  "Opens the pet menu: next tip, achievement rack, docking presets, and a reset.",
                ],
                [
                  "Drag",
                  "Moves the pet anywhere in the viewport; the tooltip flips sides to stay on screen.",
                ],
                [
                  "Drag a paper over the pet",
                  "A translucent, dashed ring marks the delete boundary. Dropping the paper deletes it from the library. The pet reacts with its current form's animation.",
                ],
                [
                  "Menu CHAT toggle",
                  "UNLOCKED opens the help library early with everything maxed — but the session is ephemeral: tips, clicks, asks, and treasures collected during free access never write real progress, and locking again restores the exact pre-unlock state.",
                ],
                [
                  "Chat (after the hunt)",
                  "The pet becomes a help library: quick questions and a free-text ask field answered from the tip catalogue.",
                ],
              ]}
            />
            <WikiCite ids={["drag-delete-ring", "per-form-disposal", "hover-dwell", "locked-ephemeral"]} />

            <WikiSub id="treasures" title="The six treasures">
              <WikiTable
                headers={["Treasure", "Page", "Hint"]}
                rows={TREASURES.map(([id, name, page, hint]) => [
                  <Chip key={id}>{name}</Chip>,
                  page,
                  hint,
                ])}
              />
            </WikiSub>
            <p className="text-sm leading-6 text-ink">
              Finding all six unlocks the pet's full capabilities: every
              tip becomes discovered (the counter reads 26/26), the deep
              tips join the click cycle, and the chat library opens.
            </p>

            <WikiSub id="achievements" title="Achievements">
              <WikiTable
                headers={["Achievement", "Condition"]}
                rows={ACHIEVEMENTS.map(([id, name, condition]) => [
                  <Chip key={id}>{name}</Chip>,
                  condition,
                ])}
              />
            </WikiSub>
            <TopicShots topic="pet" open={openPreview} />
          </WikiSection>

          <WikiSection id="garden" title="The Garden & Tree of Knowledge">
            <p className="text-sm leading-6 text-ink">
              The Lab's Garden grows a pixel tree from a winged seed
              to an ancient giant over a march of 3,000 fertilizer
              packets, bought with sun in the tree's own Sun Shop.
              Five species — the Crimson Maple, Royal Oak, Silver
              Birch, Water Elm, and Giant Redwood — each mature on
              their own curve and speak their own stage lines as
              the milestones clear.
            </p>
            <WikiSub id="garden-march" title="The march and the feet">
              <p className="text-sm leading-5 text-ink">
                Seven stages are equally divided: Seed, Seedling,
                Sapling, Young, Mature, Giant, Ancient. Every ft
                label is the tree's ACTUAL painted height — the
                canopy top measured against the ancient tree, so
                1,000 ft is always a fully grown crown. Stage chips
                above the meadow preview each milestone, stay
                pressed to preview, and pressing again morphs the
                tree smoothly back down.
              </p>
            </WikiSub>
            <WikiSub id="garden-view" title="The viewing window">
              <p className="text-sm leading-5 text-ink">
                The tree lives in the references' own 128 x 128
                window. Once it outgrows the box, the viewer
                unlocks: drag (pointer or touch), scroll to climb
                and descend, and the bottom-right arrows — every
                motion pans up and down the trunk.
              </p>
            </WikiSub>
            <WikiSub id="garden-cheats" title="Cheats">
              <p className="text-sm leading-5 text-ink">
                The tree blooms a cheat word at 250, 650, and 1,000
                feet — each species offers its own three with their
                own effects. The first bloom is announced once with
                a golden burst; typing the word anywhere arms it and
                the foliage drifts over the pages. Type it again to
                disarm.
              </p>
              <WikiTable
                headers={["Species", "250 ft", "650 ft", "1,000 ft"]}
                rows={[
                  ["Crimson Maple", "syrup", "blaze", "amber"],
                  ["Royal Oak", "daisies", "dance", "pinata"],
                  ["Silver Birch", "paper", "silver", "ribbon"],
                  ["Water Elm", "vase", "ridge", "shade"],
                  ["Giant Redwood", "grove", "mist", "elder"],
                ]}
              />
            </WikiSub>
            <WikiSub id="garden-themes" title="Backdrop themes">
              <p className="text-sm leading-5 text-ink">
                The meadow behind the tree is one of seven scenes —
                Meadow, Winter, Desert, Shore, Violet Keep, Rose
                Ruins, and Frost Spire — adopted with growth tokens
                from the Theme shop. The scene follows your local
                time zone: night when it is night, dawn at dawn,
                and the canopy rising past it sinks the world away
                in perspective while the haze thickens and birds
                and leaves pass by.
              </p>
            </WikiSub>
            <WikiSub id="garden-speech" title="Speech">
              <p className="text-sm leading-5 text-ink">
                The tree whispers every purchase and milestone into
                its speech bubble, offset right of the crown, and
                the bubble rests on a random 4-7 second cooldown —
                the pet's own bubble does the same.
              </p>
            </WikiSub>
            <TopicShots topic="garden" open={openPreview} />
          </WikiSection>

          <WikiSection id="engine" title="The recommendation engine">
            <p className="text-sm leading-6 text-ink">
              Every pipeline is a weighted combination of three components
              over a normalized prepared text (Title + Abstract +
              Keywords). The metadata component adds four fixed 25%
              signals: title, abstract, keywords, and publication-year
              proximity 1 / (1 + |Δyear|). TF-IDF and S-BERT scores are
              min-max normalized before combination; metadata scores pass
              through unchanged.
            </p>
            <WikiTable
              headers={["Pipeline", "Weights (tfidf, sbert, meta)", "Final score S(d)"]}
              rows={[
                ["TF-IDF", "(1.000, 0.000, 0.000)", "1.000 · s'_tfidf(d)"],
                ["S-BERT", "(0.000, 1.000, 0.000)", "1.000 · s'_sbert(d)"],
                ["TF-IDF + S-BERT", "(0.500, 0.500, 0.000)", "0.500 · s'_tfidf(d) + 0.500 · s'_sbert(d)"],
                ["TF-IDF + Metadata", "(0.667, 0.000, 0.333)", "0.667 · s'_tfidf(d) + 0.333 · s'_meta(d)"],
                ["S-BERT + Metadata", "(0.000, 0.667, 0.333)", "0.667 · s'_sbert(d) + 0.333 · s'_meta(d)"],
                ["Full hybrid", "(0.400, 0.400, 0.200)", "0.400 · s'_tfidf(d) + 0.400 · s'_sbert(d) + 0.200 · s'_meta(d)"],
              ]}
            />
            <p className="text-sm leading-6 text-ink">
              Ranking breaks ties by newer year, then title; only scores
              above zero are returned. The similar-papers graph reuses the
              active pipeline's own components for its edge weights (plus a
              0.15 author-overlap bonus) and computes shortest paths with
              hop cost 1 − w, so the graph can never disagree with the
              pipeline that chose its nodes. The recommendation index is
              rebuilt after repository changes. The banner in the header
              tracks staleness.
            </p>
            <TopicShots topic="engine" open={openPreview} />
          </WikiSection>

          <WikiSection id="api" title="Data & API reference">
            <p className="text-sm leading-6 text-ink">
              The backend (FastAPI + SQLAlchemy + SQLite) serves everything
              the pages use. The repository currently holds 168 records, 146
              of them valid for recommendation.
            </p>
            <WikiTable
              headers={["Subject class", "Papers"]}
              rows={SUBJECTS.map(([subject, count]) => [subject, count])}
            />
            <WikiSub id="endpoints" title="Selected endpoints">
              <WikiTable headers={["Method", "Path", "Purpose"]} rows={ENDPOINTS} />
            </WikiSub>
          </WikiSection>

          <WikiSection id="screenshots" title="Screenshots">
            <p className="text-sm leading-6 text-ink">
              The system in pictures, one shot per page. Captures taken
              from the running development build at 1440 × 900.
            </p>

            <div className="grid gap-6 sm:grid-cols-2">
              {GALLERY.map(([src, title, caption], index) => (
                <figure
                  key={src}
                  className="group overflow-hidden rounded border-[3px] border-gray-900 bg-white"
                >
                  <button
                    type="button"
                    onClick={(event) => openPreview(index, event.currentTarget)}
                    aria-label={`Preview ${title}`}
                    title="Click to preview"
                    className="block w-full cursor-zoom-in border-b-[3px] border-gray-900 transition-colors pixel-ease focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-gray-900 group-hover:bg-accentSoft"
                  >
                    <img
                      src={`/walkthrough/${src}`}
                      alt={title}
                      loading="lazy"
                      className="block w-full"
                    />
                  </button>
                  <figcaption className="p-3">
                    <p className="font-pixelify text-sm font-bold text-ink">
                      {title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {caption}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </WikiSection>

          <WikiSection id="trivia" title="Tips & trivia">
            <ul className="list-inside list-disc space-y-1.5 text-sm leading-6 text-ink">
              <li>
                The Arena's tagline is "6 modes enter. 1 leaves." The winner
                is crowned by independence-weighted consensus, so no pipeline
                can win through confirmation by its own hybrids.
              </li>
              <li>
                The six codenames, PIXEL PUNCH, GHOST WIRE, DUO MODE,
                TRIVIA QUEST, ARCHIVE MAGE, FINAL BOSS, map one-to-one to
                the pipeline configurations.
              </li>
              <li>
                The corpus grew from an earlier state of roughly 77 papers to
                168 records; the 146 valid-for-recommendation figure is what
                the engine actually searches.
              </li>
              <li>
                The similar-papers graph stores no reference lists, so shared
                authors and shared topics stand in for bibliographic coupling
               , a deliberate substitution rather than a claim of equivalence.
              </li>
              <li>
                Free-text queries only activate the metadata component's
                title signal; seed-paper searches activate all four. The
                Arena analysis is stratified by query type for this reason.
              </li>
              <li>
                The Chrome extension in the repo sends Google Scholar
                BibTeX citations straight into the Upload page.
              </li>
              <li>
                Dragging a paper onto the pet deletes it from your
                library. The pet reacts with its current form's
                animation and a speech line. Its Great Sage persona,
                Ciel, is one of the forms it can shift into.
              </li>
            </ul>
          </WikiSection>

          {/* ---- footer nav ---- */}
          <WikiFooter ctaTo="/recommendations" ctaLabel="START SEARCHING" />
        </div>
      </div>

      {/* ------------------------------------------------ LIGHTBOX */}
      {previewIndex !== null && createPortal((() => {
        const [src, title, caption] = GALLERY[previewIndex];
        const dx = previewOrigin ? previewOrigin.cx - window.innerWidth / 2 : 0;
        const dy = previewOrigin ? previewOrigin.cy - window.innerHeight / 2 : 0;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${title} — enlarged screenshot`}
            className="fixed inset-0 z-[9990] flex items-center justify-center bg-canvas p-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closePreview();
              }
            }}
          >
            <div
              ref={dialogRef}
              tabIndex={-1}
              style={{
                "--pop-x": `${dx}px`,
                "--pop-y": `${dy}px`,
              } as React.CSSProperties}
              className="lightbox-pop relative flex h-[92vh] w-[95vw] max-w-[1600px] flex-col outline-none"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 translate-x-2 translate-y-2 rounded bg-gray-900"
              />

              <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden rounded border-[3px] border-gray-900 bg-white">
                <div className="flex shrink-0 items-center justify-between gap-4 border-b-[3px] border-gray-900 bg-canvas px-5 py-3">
                  <div className="min-w-0">
                    <h2 className="font-pixelify truncate text-xl font-bold leading-snug text-ink">
                      {title}
                    </h2>
                    <p className="text-sm text-muted">
                      Screenshot {previewIndex + 1} of {GALLERY.length}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => stepPreview(-1)}
                      aria-label="Previous screenshot"
                      className="rounded border-[3px] border-gray-900 bg-white px-3 py-1.5 font-mono text-sm font-semibold text-ink transition-colors pixel-ease hover:bg-accentSoft"
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => stepPreview(1)}
                      aria-label="Next screenshot"
                      className="rounded border-[3px] border-gray-900 bg-white px-3 py-1.5 font-mono text-sm font-semibold text-ink transition-colors pixel-ease hover:bg-accentSoft"
                    >
                      Next →
                    </button>
                    <button
                      type="button"
                      onClick={closePreview}
                      aria-label="Close preview"
                      className="rounded border-[3px] border-gray-900 bg-white px-3 py-1.5 font-mono text-sm font-semibold text-ink transition-colors pixel-ease hover:bg-accentSoft"
                    >
                      <CloseX className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas p-4">
                  <img
                    src={`/walkthrough/${src}`}
                    alt={title}
                    className="max-h-full max-w-full rounded border-[3px] border-gray-900"
                  />
                </div>

                <div className="shrink-0 border-t-[3px] border-gray-900 bg-canvas px-5 py-3">
                  <p className="font-pixelify text-sm font-bold text-ink">
                    {title}
                  </p>
                  <p className="mt-0.5 text-sm leading-5 text-muted">
                    {caption}
                  </p>
                  <p className="mt-1 font-mono text-[11px] tracking-[0.15em] text-muted">
                    CLICK OUTSIDE OR PRESS ESC TO CLOSE · ← → TO NAVIGATE
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
}
