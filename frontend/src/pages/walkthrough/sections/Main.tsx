import { Chip, WikiInfobox, WikiSection } from "../wiki";
import { P, WikiThumb, Xref } from "../wikiMedia";

const INFOBOX_ROWS: [string, string][] = [
  ["Name", "Re:Search · BulSU BSMCS"],
  ["Type", "Academic paper repository and hybrid recommendation system"],
  ["Developer", "TEMPEST · BSMCS thesis project, Bulacan State University"],
  ["Stack", "FastAPI · SQLAlchemy · SQLite · scikit-learn · sentence-transformers · React · TypeScript · Vite · Tailwind"],
  ["Models", "TF-IDF (scikit-learn) · S-BERT (all-MiniLM-L6-v2)"],
  ["Pipelines", "6 fixed configurations + 1 custom dial"],
  ["Sources", "Local corpus · OpenAlex · Crossref · arXiv"],
  ["Modes", "Library · Researcher · Presentation"],
  ["Pages", "Repository · Upload · My Library · Arena · Lab · Walkthrough · Engine · FAQ · Settings · Changelog"],
  ["Status", "Local research prototype"],
];

export function WalkthroughMain() {
  return (
    <WikiSection id="overview" title="Overview">
      <div className="mb-3 w-full overflow-hidden rounded border-[3px] border-gray-900 bg-white sm:float-right sm:ml-5 sm:w-[300px]">
        <p className="border-b-[3px] border-gray-900 bg-accent px-3 py-1.5 text-center font-mono text-xs font-bold uppercase tracking-[0.15em] text-onAccent">
          Re:Search
        </p>
        <WikiThumb id="repository" float="center" width={290} caption="The Repository in Researcher mode." />
        <WikiInfobox rows={INFOBOX_ROWS} />
      </div>

      <P>
        <b>Re:Search</b> is a local academic paper repository and recommendation system built as a thesis
        prototype at Bulacan State University. It stores papers imported from PDFs, BibTeX citations, DOIs
        and arXiv ids; checks that each one has the four things recommendation needs (title, abstract,
        keywords, publication year); represents it with a lexical vector (TF-IDF) and a semantic embedding
        (S-BERT); and recommends related literature through six fixed pipeline configurations and one
        user-set dial mix.
      </P>
      <P>
        The same pipelines rank three kinds of candidate: the papers in the local corpus, papers similar to
        a seed paper, and live results from the open scholarly web (OpenAlex, Crossref and arXiv). Pressing a
        different algorithm re-ranks what is on screen at once. The <Chip>Arena</Chip> runs all six pipelines
        on one query and compares them with a consensus ranking, pairwise agreement and an
        independence-weighted winner, so the comparison the thesis reports can be reproduced by anyone with a
        query.
      </P>
      <P>
        Around that machinery sit a personal library with a Pro tier (dashboard, similarity graph and a
        research chat), a recipe bench for designing your own pipeline, and an arcade-flavored layer: a pixel
        pet, a scavenger hunt and a Garden whose Tree of Knowledge teaches the system. The site runs in three
        modes: <Chip>Library</Chip> for visitors, <Chip>Researcher</Chip> for the full tool and{" "}
        <Chip>Presentation</Chip> for the shipped, free version.
      </P>
      <P>
        This wiki has two manuals. The <b>Walkthrough</b> documents every page and feature of the application
        with screenshots; the <Xref to="/walkthrough-engine">Engine</Xref> documents the mathematics and the
        computer science behind the numbers. Pick a topic below, or use the contents on the left. Every
        screenshot was captured from the running application in Researcher mode with the default theme and
        every unlock switched on; click any picture to open it full screen, and use the arrow keys to step
        through them all.
      </P>
    </WikiSection>
  );
}
