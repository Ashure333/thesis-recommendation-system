import { Chip, WikiSection, WikiSub, WikiTable } from "../wiki";
import { P, WikiGallery, WikiNote, WikiThumb, Xref } from "../wikiMedia";

const ENDPOINTS = [
  ["GET", "/api/papers", "List, search, filter and sort papers"],
  ["GET", "/api/papers/stats", "Repository statistics"],
  ["POST", "/api/papers/upload", "Upload a PDF, BibTeX, RIS or EndNote file"],
  ["POST", "/api/papers/import-url", "Import from a Google Scholar BibTeX / EndNote / RefMan URL"],
  ["POST", "/api/papers/import-bibtex", "Import a pasted BibTeX citation"],
  ["POST", "/api/papers/import-metadata", "Save a web hit or a resolved identifier (with duplicate detection)"],
  ["PATCH", "/api/papers/{id}", "Update paper metadata"],
  ["DELETE", "/api/papers/{id}", "Delete a paper"],
  ["GET", "/api/papers/{id}/pdf", "View the stored PDF"],
  ["GET", "/api/papers/{id}/find-pdf", "Search for open-access PDF candidates"],
  ["POST", "/api/papers/{id}/attach-pdf", "Download and attach a chosen PDF"],
  ["GET", "/api/papers/{id}/similar-graph", "Build the similar-papers graph"],
  ["GET", "/api/recommendations", "Ranked recommendations from the repository (one pipeline, a query or a seed)"],
  ["GET", "/api/recommendations/web", "Live web hits ranked by one pipeline, each with rank, score and components"],
  ["POST", "/api/recommendations/trace", "Real-time math trace of one search"],
  ["POST", "/api/recommendations/compare", "Arena battle: all six pipelines at once"],
  ["POST", "/api/recommendations/web-compare", "Web battle: all six pipelines over live web hits"],
  ["GET", "/api/recommendations/status", "Is the index stale?"],
  ["POST", "/api/recommendations/rebuild", "Rebuild vectors and embeddings"],
  ["GET", "/api/search-web", "Search OpenAlex, Crossref and arXiv (source ordering)"],
  ["GET", "/api/evaluation/battles", "Battle history and the win tally"],
  ["GET", "/api/library", "The personal library"],
  ["POST", "/api/library/{id}", "Save a paper"],
  ["DELETE", "/api/library/{id}", "Remove a paper"],
  ["POST", "/api/research-chat", "Ask the research assistant (collection, repository or web)"],
] as const;

export function OtherPages() {
  return (
      <WikiSection id="other-pages" title="FAQ, Changelog and the site editor">
        <WikiThumb id="faq" width={340} />
        <P>
          <Chip>FAQ</Chip> answers the first questions a visitor asks (what the system is, how to search,
          browse, save and upload, what happens at sign-out) as expanding rows.{" "}
          <Chip>Changelog</Chip> lists the release notes, newest first, as a timeline or a grid; each note has
          a short summary and a <Chip>Details</Chip> line with the engineering detail, and the list is paged.
          Walkthrough sections cite the notes that shaped them.
        </P>
        <WikiGallery cols={2} ids={["changelog", "changelog-grid"]} />
        <P>
          The <Chip>site editor</Chip> at <Chip>/admin</Chip> is for library staff. After a staff sign-in it posts
          announcements for the home page and sets, for each feature, whether Library mode shows it, shows
          it locked or hides it. Researcher mode ignores those states; Presentation mode uses its own fixed
          lineup.
        </P>
      </WikiSection>
  );
}

export function Shortcuts() {
  return (
      <WikiSection id="shortcuts" title="Shortcuts and gestures">
        <WikiTable
          headers={["Input", "Where", "Does"]}
          rows={[
            [<Chip key="1">`</Chip>, "Anywhere (not in a field)", "Opens the cheat console."],
            [<Chip key="2">P + R + O</Chip>, "Presentation mode", "Opens the password prompt to leave Presentation mode."],
            [<Chip key="3">Enter</Chip>, "Query boxes", "Runs the search, ranking or battle."],
            [<Chip key="4">Esc</Chip>, "Pop-ups, console, viewers", "Closes them."],
            [<Chip key="5">← →</Chip>, "Full-screen image viewer", "Previous and next image."],
            [<Chip key="6">Drag</Chip>, "Pet, garden, pane handles", "Moves the pet, climbs the tree, resizes the panes."],
            [<Chip key="7">Double-click</Chip>, "Table cell · pet", "Edits a cell in place · opens the pet menu."],
            [<Chip key="8">Right-click</Chip>, "Table row", "Opens the row menu."],
            [<Chip key="9">Click or tap</Chip>, "A garden creature", "The creature reacts."],
          ]}
        />
      </WikiSection>
  );
}

export function ApiReference() {
  return (
      <WikiSection id="api" title="Data and API reference">
        <P>
          The backend is FastAPI with SQLAlchemy over a single SQLite file. The repository currently
          stores 181 records, 156 of them valid for recommendation; the largest subject classes are
          Computer Science: Machine Learning (100), Mathematics: Mathematical Analysis (17),
          Mathematical Modeling (14), Graph Theory (13) and Linear Algebra (10), with 22 subject labels
          in all. The vectors live in JSON columns of the same database and are rebuilt from the
          Repository when it changes; the header banner says when the index is stale.
        </P>
        <WikiSub id="endpoints" title="Selected endpoints">
          <WikiTable headers={["Method", "Path", "Purpose"]} rows={ENDPOINTS} />
        </WikiSub>
        <WikiNote kind="note">
          Web endpoints only use public scholarly APIs (OpenAlex, Crossref, arXiv, Unpaywall, Semantic
          Scholar); nothing is scraped. Identical queries in flight share one upstream request, and recent
          answers are cached briefly.
        </WikiNote>
      </WikiSection>
  );
}

export function TriviaPage() {
  return (
      <WikiSection id="trivia" title="Tips and trivia">
        <ul className="list-inside list-disc space-y-1.5 text-sm leading-6 text-ink">
          <li>The Arena's tagline is "6 modes enter. 1 leaves." The winner is crowned by independence-weighted consensus, so no pipeline wins by confirmation from its own hybrids.</li>
          <li>The six codenames (PIXEL PUNCH, GHOST WIRE, DUO MODE, TRIVIA QUEST, ARCHIVE MAGE, FINAL BOSS) map one to one to the six pipelines; Presentation mode swaps them for the formal names.</li>
          <li>Pressing an algorithm re-ranks the query on screen, in the Repository's Recommend and Web scopes. The header always names the algorithm behind the list.</li>
          <li>A free-text query has no publication year, so its Metadata score tops out at 0.75; a seed-paper search can reach 1. The Arena analysis is stratified by query type for this reason.</li>
          <li>The similar-papers graph adds a citation term (bibliographic coupling and co-citation) from reference lists cached from OpenAlex; a paper without cached rows contributes exactly 0.</li>
          <li>The pet leans on its inner Great Sage to analyze recommendations, and Ciel, its personified form, says "calculation complete".</li>
          <li>The Chrome extension in the repository sends Google Scholar BibTeX citations straight to the Upload page.</li>
          <li>The full formulas, with worked numbers, are on the <Xref to="/walkthrough-engine">Engine page</Xref>.</li>
        </ul>
      </WikiSection>
  );
}

