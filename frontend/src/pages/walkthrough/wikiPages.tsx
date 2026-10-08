/**
 * The wiki's page registry: every article of both manuals, in reading order,
 * with the group it sits in, a one-line summary for search and the main-page
 * cards, a thumbnail and the component that renders it.
 *
 * URLs: /walkthrough/<slug> and /walkthrough-engine/<slug>; the main page of
 * each manual has no slug.
 */

import type { ReactNode } from "react";

import {
  ArenaPage,
  LabPage,
} from "./sections/ArenaLab";
import { GardenPage } from "./sections/Garden";
import { WalkthroughMain } from "./sections/Main";
import { Customizing, PetPage } from "./sections/PetCustom";
import {
  ApiReference,
  OtherPages,
  Shortcuts,
  TriviaPage,
} from "./sections/Reference";
import { RepositoryPage, Recommending } from "./sections/RepositorySection";
import { GettingStarted, SiteModes } from "./sections/Start";
import { MyLibraryPage, UploadPage } from "./sections/UploadLibrary";
import {
  ArenaVoting,
  Complexity,
  Embeddings,
  EngineOverview,
  Engineering,
  Flow,
  Fusion,
  Graph,
  Metadata,
  Ranking,
  Trivia,
  VectorSpace,
  WorkedExample,
} from "./engine/EngineSections";
import { WebRanking } from "./engine/WebRanking";


export type WikiId = "walkthrough" | "engine";

export interface WikiPage {
  wiki: WikiId;
  /** "main" is the portal and has no slug in the URL. */
  slug: string;
  title: string;
  summary: string;
  group: string;
  /** A screenshot id for the main-page card. */
  thumb?: string;
  categories: string[];
  render: () => ReactNode;
}

export const WIKIS: Record<
  WikiId,
  { name: string; base: string; tagline: string; feature: string }
> = {
  walkthrough: {
    name: "Walkthrough",
    base: "/walkthrough",
    tagline: "Every page and feature of the application, with screenshots.",
    feature: "walkthrough",
  },
  engine: {
    name: "Engine",
    base: "/walkthrough-engine",
    tagline: "The mathematics and computer science behind every number.",
    feature: "engine",
  },
};

const W = (p: Omit<WikiPage, "wiki">): WikiPage => ({ wiki: "walkthrough", ...p });
const E = (p: Omit<WikiPage, "wiki">): WikiPage => ({ wiki: "engine", ...p });

export const PAGES: WikiPage[] = [
  /* ------------------------------------------------------ Walkthrough */
  W({
    slug: "main",
    title: "Main page",
    summary: "What Re:Search is, and where to start.",
    group: "Introduction",
    thumb: "repository",
    categories: ["Re:Search", "Documentation"],
    render: () => <WalkthroughMain />,
  }),
  W({
    slug: "getting-started",
    title: "Getting started",
    summary: "Sign in, the boot screen, the home page and the top bar.",
    group: "Introduction",
    thumb: "home-researcher",
    categories: ["Basics"],
    render: () => <GettingStarted />,
  }),
  W({
    slug: "site-modes",
    title: "Site modes",
    summary: "Library, Researcher and Presentation: what each shows and how to switch.",
    group: "Introduction",
    thumb: "mode-presentation-repository",
    categories: ["Basics", "Modes"],
    render: () => <SiteModes />,
  }),
  W({
    slug: "repository",
    title: "Repository",
    summary: "The three-pane workspace: filters, the paper table, the algorithm bar, the inspector.",
    group: "Searching and saving",
    thumb: "repository-list",
    categories: ["Pages", "Search"],
    render: () => <RepositoryPage />,
  }),
  W({
    slug: "recommending",
    title: "Recommending",
    summary: "Rank a query or a seed paper, rank the live web, and re-rank with any algorithm.",
    group: "Searching and saving",
    thumb: "repository-web",
    categories: ["Search", "Recommendation"],
    render: () => <Recommending />,
  }),
  W({
    slug: "upload",
    title: "Upload",
    summary: "PDF, BibTeX, DOI and arXiv import, the review form, validation and duplicates.",
    group: "Searching and saving",
    thumb: "upload-identifier-review",
    categories: ["Pages", "Import"],
    render: () => <UploadPage />,
  }),
  W({
    slug: "my-library",
    title: "My Library",
    summary: "The personal shortlist and its Pro tabs: Dashboard, Graph and Chat.",
    group: "Searching and saving",
    thumb: "library-graph-selected",
    categories: ["Pages", "Pro"],
    render: () => <MyLibraryPage />,
  }),
  W({
    slug: "arena",
    title: "Arena",
    summary: "Six pipelines, one query: consensus, pairwise agreement, the winner and the battle log.",
    group: "Comparing algorithms",
    thumb: "arena-winner",
    categories: ["Pages", "Evaluation"],
    render: () => <ArenaPage />,
  }),
  W({
    slug: "lab",
    title: "Lab: the recipe bench",
    summary: "Design your own weights and test them against the six presets.",
    group: "Comparing algorithms",
    thumb: "lab-simulated",
    categories: ["Pages", "Evaluation"],
    render: () => <LabPage />,
  }),
  W({
    slug: "garden",
    title: "The Garden",
    summary: "The Tree of Knowledge: stages, species, charms, scenery, shops and the facts it teaches.",
    group: "The playful layer",
    thumb: "garden-stage-summit",
    categories: ["Garden", "Playful"],
    render: () => <GardenPage />,
  }),
  W({
    slug: "pixel-pet",
    title: "The pixel pet",
    summary: "The companion, its eleven forms, the scavenger hunt and the achievements.",
    group: "The playful layer",
    thumb: "pet-idle",
    categories: ["Playful"],
    render: () => <PetPage />,
  }),
  W({
    slug: "customizing",
    title: "Customizing",
    summary: "Themes, dark mode, settings, the cheat console, hidden looks and the NERD switch.",
    group: "The playful layer",
    thumb: "skin-blueprint",
    categories: ["Settings", "Playful"],
    render: () => <Customizing />,
  }),
  W({
    slug: "faq-changelog",
    title: "FAQ, Changelog and site editor",
    summary: "The help page, the release notes and the library staff's editor.",
    group: "Reference",
    thumb: "faq",
    categories: ["Reference"],
    render: () => <OtherPages />,
  }),
  W({
    slug: "shortcuts",
    title: "Shortcuts and gestures",
    summary: "Every key, click and drag the application listens for.",
    group: "Reference",
    categories: ["Reference"],
    render: () => <Shortcuts />,
  }),
  W({
    slug: "api-reference",
    title: "Data and API reference",
    summary: "The corpus in numbers and the endpoints the pages use.",
    group: "Reference",
    categories: ["Reference", "API"],
    render: () => <ApiReference />,
  }),
  W({
    slug: "trivia",
    title: "Tips and trivia",
    summary: "Small facts worth knowing.",
    group: "Reference",
    categories: ["Reference"],
    render: () => <TriviaPage />,
  }),

  /* ------------------------------------------------------------ Engine */
  E({
    slug: "main",
    title: "Main page",
    summary: "The engine in one page: the pipeline at a glance and three flow figures.",
    group: "Introduction",
    thumb: "repository-stats-for-nerds",
    categories: ["Mathematics", "Computer Science"],
    render: () => (
      <>
        <EngineOverview />
        <Flow />
      </>
    ),
  }),
  E({
    slug: "vector-space",
    title: "The vector space model and TF-IDF",
    summary: "Documents as vectors, term weighting and cosine similarity.",
    group: "The three signals",
    thumb: "repository-recommend",
    categories: ["Mathematics", "Lexical"],
    render: () => <VectorSpace />,
  }),
  E({
    slug: "embeddings",
    title: "Sentence embeddings and S-BERT",
    summary: "Dense vectors from a transformer and why they find paraphrases.",
    group: "The three signals",
    thumb: "repository-recommend-ghost-wire",
    categories: ["Mathematics", "Semantic"],
    render: () => <Embeddings />,
  }),
  E({
    slug: "metadata",
    title: "The metadata component",
    summary: "Four fields at 25% each, year proximity and what a missing field costs.",
    group: "The three signals",
    thumb: "upload-identifier-review",
    categories: ["Mathematics", "Metadata"],
    render: () => <Metadata />,
  }),
  E({
    slug: "fusion-and-ranking",
    title: "Normalization, fusion and ranking",
    summary: "Min-max scaling, the weighted sum, the six weight sets, ties and MMR diversification.",
    group: "Ranking",
    thumb: "repository-algorithm-dials",
    categories: ["Mathematics", "Ranking"],
    render: () => (
      <>
        <Fusion />
        <Ranking />
      </>
    ),
  }),
  E({
    slug: "web-ranking",
    title: "Ranking the web",
    summary: "The same pipelines over live OpenAlex, Crossref and arXiv hits.",
    group: "Ranking",
    thumb: "repository-web",
    categories: ["Ranking", "Web"],
    render: () => <WebRanking />,
  }),
  E({
    slug: "graph",
    title: "The similar-papers graph",
    summary: "Edge weights from the pipeline, cluster zones and Dijkstra's shortest paths.",
    group: "Structures",
    thumb: "library-graph-selected",
    categories: ["Computer Science", "Graph"],
    render: () => <Graph />,
  }),
  E({
    slug: "arena-voting",
    title: "The Arena as a voting system",
    summary: "Consensus ranking, pairwise agreement and the independence-weighted winner.",
    group: "Evaluation",
    thumb: "arena-pairwise",
    categories: ["Evaluation", "Mathematics"],
    render: () => <ArenaVoting />,
  }),
  E({
    slug: "complexity",
    title: "Algorithms and complexity",
    summary: "What each step costs, and the computer science behind the scenes.",
    group: "Computer science",
    categories: ["Computer Science"],
    render: () => (
      <>
        <Complexity />
        <Engineering />
      </>
    ),
  }),
  E({
    slug: "worked-example",
    title: "Worked example",
    summary: "Inputs, fusion, the graph and Dijkstra, step by step with numbers.",
    group: "Computer science",
    categories: ["Mathematics", "Example"],
    render: () => <WorkedExample />,
  }),
  E({
    slug: "trivia",
    title: "Tips and trivia",
    summary: "Small facts about the engine.",
    group: "Reference",
    categories: ["Reference"],
    render: () => <Trivia />,
  }),
];

export const pagesOf = (wiki: WikiId): WikiPage[] => PAGES.filter((page) => page.wiki === wiki);

export const pageUrl = (page: Pick<WikiPage, "wiki" | "slug">): string =>
  page.slug === "main" ? WIKIS[page.wiki].base : `${WIKIS[page.wiki].base}/${page.slug}`;

export function groupsOf(wiki: WikiId): [string, WikiPage[]][] {
  const groups: [string, WikiPage[]][] = [];

  for (const page of pagesOf(wiki)) {
    const found = groups.find(([name]) => name === page.group);

    if (found) found[1].push(page);
    else groups.push([page.group, [page]]);
  }

  return groups;
}
