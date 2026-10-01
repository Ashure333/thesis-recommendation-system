import {
  Chip,
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
  ["tip-master", "Tip Master", "Discover every tip (23/23)"],
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
  ["GET", "/api/recommendations/status", "Check if the index is stale"],
  ["POST", "/api/recommendations/rebuild", "Rebuild vectors and embeddings"],
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
  ["Developer", "BSMCS thesis project at Bulacan State University"],
  ["Tech", "FastAPI · SQLAlchemy · SQLite · scikit-learn · sentence-transformers · React · TypeScript · Vite · Tailwind"],
  ["Models", "TF-IDF (scikit-learn) · S-BERT (all-MiniLM-L6-v2)"],
  ["Pipelines", "6 fixed configurations + 1 custom dial"],
  ["Pages", "Recommendations · Repository · Upload · My Library · Arena · FAQ"],
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
  ["engine", "The recommendation engine"],
  ["api", "Data & API reference"],
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
] as const;

export default function Walkthrough() {
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
                pointer still. The pixel pet dwells for five seconds and
                then explains what that element does.
              </p>
            </WikiSub>
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
          </WikiSection>

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
                  "Paper actions",
                  "View the attached PDF in a modal, edit metadata, search for an open-access PDF online, or delete the record.",
                ],
                [
                  "PDF discovery",
                  "For records without a stored file, the system queries Unpaywall, Crossref, Semantic Scholar, arXiv, and OpenAlex, and can download and attach the best candidate.",
                ],
              ]}
            />
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
              ]}
            />
          </WikiSection>

          <WikiSection id="pet" title="The pixel pet & scavenger hunt">
            <p className="text-sm leading-6 text-ink">
              The pet is a clipper-style companion that explains the
              interface, runs a scavenger hunt, hands out achievements, and
              becomes a help library. It lives in the bottom-right corner,
              is draggable, and its position persists.
            </p>
            <WikiTable
              headers={["Interaction", "What happens"]}
              rows={[
                [
                  "Hover (main way)",
                  "Hold the pointer on any element labeled with a tip; the pet dwells for 5 seconds (progress ring + percent chip) and reveals the tip. A 3-second cooldown rests the pet between reveals.",
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
                  "Chat (after the hunt)",
                  "The pet becomes a help library: quick questions and a free-text ask field answered from the tip catalogue.",
                ],
              ]}
            />

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
              tip becomes discovered (the counter reads 23/23), the deep
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
            </ul>
          </WikiSection>

          {/* ---- footer nav ---- */}
          <WikiFooter ctaTo="/recommendations" ctaLabel="START SEARCHING" />
        </div>
      </div>
    </div>
  );
}