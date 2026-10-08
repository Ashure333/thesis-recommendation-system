import {
  Chip,
  MathBlock,
  WikiCite,
  WikiInfobox,
  WikiSection,
  WikiSub,
  WikiTable,
} from "../wiki";
import { isPresentationStored } from "../../../utils/presentation";
import FlowDiagram from "../FlowDiagram";
import { P, WikiGallery, WikiHatnote, WikiNote, WikiThumb, Xref } from "../wikiMedia";

/* The Engine manual's sections, one component each. The wiki shell composes
   them into pages (see wikiPages.ts). */

const INFOBOX_ROWS: [string, string][] = [
  ["Name", "The Re:Search engine"],
  ["Developer", "TEMPEST"],
  ["Core models", "Vector space (TF-IDF) · sentence embeddings (S-BERT) · metadata fusion · weighted graph"],
  ["Algorithms", "TF-IDF · cosine similarity · min-max normalization · Dijkstra's shortest paths · independence-weighted voting"],
  ["Embedding model", "all-MiniLM-L6-v2, 6 layers, 384 dimensions"],
  ["Signals", "TF-IDF (lexical) · S-BERT (semantic) · Metadata (4 fields)"],
  ["Pipelines", "6 fixed configurations + 1 custom dial"],
  ["Scale", "n = 156 valid papers · per-search work O(n·d)"],
  ["Determinism", "Deterministic (total tie-breaks, fixed seeds)"],
  ["Status", "Local research prototype"],
];



const PIPELINE_ROWS = [
  ["TF-IDF", "(1.000, 0.000, 0.000)", "1.000 · s'_tfidf(d)"],
  ["S-BERT", "(0.000, 1.000, 0.000)", "1.000 · s'_sbert(d)"],
  ["TF-IDF + S-BERT", "(0.500, 0.500, 0.000)", "0.500 · s'_tfidf(d) + 0.500 · s'_sbert(d)"],
  ["TF-IDF + Metadata", "(0.667, 0.000, 0.333)", "0.667 · s'_tfidf(d) + 0.333 · s'_meta(d)"],
  ["S-BERT + Metadata", "(0.000, 0.667, 0.333)", "0.667 · s'_sbert(d) + 0.333 · s'_meta(d)"],
  ["Full hybrid", "(0.400, 0.400, 0.200)", "0.400 · s'_tfidf(d) + 0.400 · s'_sbert(d) + 0.200 · s'_meta(d)"],
] as const;

const INDEPENDENCE_ROWS = [
  ["tfidf vs sbert", "∅ (disjoint)", "1 − 0 = 1.00"],
  ["tfidf vs tfidf_sbert", "{tfidf}", "1 − 1/2 = 0.50"],
  ["tfidf vs tfidf_sbert_metadata", "{tfidf}", "1 − 1/3 = 0.67"],
  ["sbert vs sbert_metadata", "{sbert}", "1 − 1/2 = 0.50"],
  ["tfidf_sbert vs tfidf_metadata", "{tfidf}", "1 − 1/2 = 0.50"],
  ["tfidf_sbert vs sbert_metadata", "{sbert}", "1 − 1/3 = 0.67"],
] as const;

const COMPLEXITY_ROWS = [
  ["Index build (TF-IDF)", "Fit vocabulary + IDF over the corpus", "O(n·L̄) tokenization; O(n·d_tfidf) storage"],
  ["Index build (S-BERT)", "Encode every paper once", "n model forward passes; O(n·384) storage"],
  ["One search (any pipeline)", "Score all valid candidates", "O(n·d) cosine work per active component; O(n) small metadata fits"],
  ["Diversify (MMR, optional)", "Greedy rerank of the top-50 positive-score pool", "pool(pool − 1)/2 pair similarities, each O(d): 1,225 at the default pool, never an n × n matrix"],
  ["Arena battle", "Six searches + comparisons", "6 × search, then O(36·k) pairwise and O(6n) consensus"],
  ["Similar-papers graph: weights", "A blended weight for every pair of the V = k + 1 papers", "O(V²·d) cosines, plus metadata per node: 3 field vectorizers over the other papers, O(V²·L̄) text work"],
  ["Similar-papers graph: Dijkstra", "Binary-heap shortest paths from the origin over V nodes and E edges", "O((V + E) log V); with V ≤ 41 in the UI and E ≤ V(V − 1)/2 ≤ 820 it is negligible"],
  ["Duplicate check (upload)", "Compare the new title/DOI to existing papers", "O(m) title-similarity passes over m stored papers"],
] as const;

const ENGINEERING_ROWS = [
  ["Prepared text", "Title + Abstract + Keywords, normalized (lowercase, punctuation stripped, whitespace collapsed). The single input to every component."],
  ["Validation gate", "A paper is searchable only when title, abstract, keywords, and publication year are present (is_valid_for_recommendation)."],
  ["Index rebuild", "Repository changes flag the index stale (JSON status file); a rebuild re-runs classification → validation → prepared text → TF-IDF → S-BERT."],
  ["Duplicate detection", "Uploads are blocked with HTTP 409 on an exact DOI or a blended title similarity ≥ 0.85."],
  ["Keyword generation", "Papers without keywords get them from title + abstract via YAKE (unsupervised)."],
  ["Storage", "SQLite holds the records; TF-IDF vectors and S-BERT embeddings are JSON-encoded columns; uploaded PDFs live in storage/papers/."],
  ["Determinism", "Ranking tie-breaks (year, title) and Dijkstra tie-breaks (paper id) are total orders, so the same inputs always produce the same output."],
] as const;

const WORKED_NOTE =
  "Numbers below are synthetic and rounded for readability; the real engine computes full-precision values. The pattern is what matters.";


export function EngineOverview() {
  return (
    <>
          <div className="grid gap-6 md:grid-cols-5">
            <div className="md:col-span-3">
              <WikiSection id="overview" title="Overview">
                <p className="text-sm leading-6 text-ink">
                  Re:Search answers one question: given a query or a paper,
                  which papers in the repository are most related? The
                  answer is a pipeline of linear algebra: papers are turned
                  into vectors, the query is turned into a vector, and
                  relatedness is scored with the cosine of the angle between
                  them. Three vector families are combined: a sparse
                  lexical one (TF-IDF), a dense semantic one (S-BERT), and a
                  small four-field metadata one, under configurable
                  weights. Two richer structures sit on top: a weighted
                  graph of similar papers, and the Arena, a voting system
                  that compares the six pipeline configurations against one
                  another.
                </p>
                <p className="text-sm leading-6 text-ink">
                  Everything below states exactly what the implementation
                  computes (app/services/recommendation/* and
                  app/services/connected_graph.py). The walkthrough
                  convention holds: notation first, then each formula, its
                  role, and where it appears in the pipeline.
                </p>
              </WikiSection>
            </div>
            <div className="md:col-span-2">
              <p className="mb-2 font-mono text-xs font-bold tracking-[0.2em] text-accent">
                ENGINE INFO
              </p>
              <WikiInfobox rows={INFOBOX_ROWS} />
            </div>
          </div>
    </>
  );
}

export function Flow() {
  const shipped = isPresentationStored();

  return (
          <WikiSection id="flow" title="The process at a glance (flow)">
          <WikiThumb id="repository-recommend" width={300} caption="Where the pipeline surfaces in the application: a query ranked in the Repository, with a score bar per row." />
            <p className="text-sm leading-6 text-ink">
              Three figures put the pieces together before the formulas
              below: the recommendation pipeline end to end, how the four
              metadata signals combine, and what an Arena battle runs on
              every query.
            </p>

            <FlowDiagram
              title="Figure 1 — The recommendation pipeline"
              nodes={[
                { id: "query", label: "Query / seed", sub: "text or paper", x: 20, y: 130, w: 130, h: 52 },
                { id: "prepare", label: "Text preparation", sub: "normalize(T + A + K)", x: 190, y: 130, w: 160, h: 52 },
                { id: "tfidf", label: "TF-IDF", sub: "smoothed IDF · L2", x: 470, y: 14, w: 150, h: 52 },
                { id: "sbert", label: "S-BERT", sub: "384-d embeddings", x: 470, y: 130, w: 150, h: 52 },
                { id: "meta", label: "Metadata", sub: "4 fields · 25% each", x: 470, y: 246, w: 150, h: 52 },
                { id: "norm", label: "Normalize", sub: "min–max · meta passes", x: 670, y: 130, w: 170, h: 52 },
                { id: "fuse", label: "Weighted fusion", sub: "S(d) = Σ wᵢ·s′ᵢ", x: 890, y: 130, w: 160, h: 52 },
                { id: "rank", label: "Rank & output", sub: "top_k · ties by year", x: 890, y: 252, w: 160, h: 52, accent: true },
              ]}
              edges={[
                { from: "query", to: "prepare" },
                { from: "prepare", to: "tfidf", label: "cleaned text" },
                { from: "prepare", to: "sbert" },
                { from: "prepare", to: "meta" },
                { from: "tfidf", to: "norm" },
                { from: "sbert", to: "norm" },
                { from: "meta", to: "norm" },
                { from: "norm", to: "fuse" },
                { from: "fuse", to: "rank" },
              ]}
            />

            <FlowDiagram
              title="Figure 2 — The metadata component"
              nodes={[
                { id: "title", label: "Title", sub: "f(Q) + all candidates", x: 20, y: 26, w: 190, h: 52 },
                { id: "abstract", label: "Abstract", sub: "f(Q) + all candidates", x: 20, y: 92, w: 190, h: 52 },
                { id: "keywords", label: "Keywords", sub: "f(Q) + all candidates", x: 20, y: 158, w: 190, h: 52 },
                { id: "year", label: "Year", sub: "1 / (1 + |Δyear|)", x: 20, y: 224, w: 190, h: 52 },
                { id: "fields", label: "Per-field SIFTER", sub: "one vectorizer per field", x: 310, y: 110, w: 190, h: 84 },
                { id: "weights", label: "Equal weights", sub: "0.25 + 0.25 + 0.25 + 0.25", x: 620, y: 122, w: 200, h: 60 },
                { id: "clamp", label: "s_meta(d)", sub: "clamped to [0, 1] · missing = 0", x: 860, y: 122, w: 200, h: 60, accent: true },
              ]}
              edges={[
                { from: "title", to: "fields" },
                { from: "abstract", to: "fields" },
                { from: "keywords", to: "fields" },
                { from: "year", to: "fields" },
                { from: "fields", to: "weights", label: "four cosines" },
                { from: "weights", to: "clamp" },
              ]}
            />

            <FlowDiagram
              title="Figure 3 — The Arena battle"
              nodes={[
                { id: "q", label: "One query", sub: "or one seed paper", x: 20, y: 96, w: 120, h: 140 },
                {
                  id: "p1",
                  label: shipped ? "TF-IDF" : "PIXEL PUNCH",
                  sub: shipped ? "lexical only" : "TF-IDF 100%",
                  x: 210, y: 12, w: 214, h: 44,
                },
                {
                  id: "p2",
                  label: shipped ? "S-BERT" : "GHOST WIRE",
                  sub: shipped ? "semantic only" : "S-BERT 100%",
                  x: 210, y: 64, w: 214, h: 44,
                },
                {
                  id: "p3",
                  label: shipped ? "TF-IDF + S-BERT" : "DUO MODE",
                  sub: shipped ? "lexical + semantic" : "TF-IDF + S-BERT",
                  x: 210, y: 116, w: 214, h: 44,
                },
                {
                  id: "p4",
                  label: shipped ? "TF-IDF + Metadata" : "TRIVIA QUEST",
                  sub: shipped ? "lexical + metadata" : "TF-IDF + meta",
                  x: 210, y: 168, w: 214, h: 44,
                },
                {
                  id: "p5",
                  label: shipped ? "S-BERT + Metadata" : "ARCHIVE MAGE",
                  sub: shipped ? "semantic + metadata" : "S-BERT + meta",
                  x: 210, y: 220, w: 214, h: 44,
                },
                {
                  id: "p6",
                  label: shipped ? "TF-IDF + S-BERT + Metadata" : "FINAL BOSS",
                  sub: "all three signals",
                  x: 210, y: 272, w: 214, h: 44,
                },
                { id: "six", label: "Six rankings", sub: "same batch of candidates", x: 494, y: 96, w: 140, h: 140 },
                { id: "vote", label: "Consensus & agreement", sub: "Borda-style · pairwise · winner", x: 694, y: 120, w: 196, h: 92 },
                { id: "log", label: "Battle log", sub: "every run, tallied", x: 950, y: 132, w: 130, h: 68, accent: true },
              ]}
              edges={[
                { from: "q", to: "p1" },
                { from: "q", to: "p2" },
                { from: "q", to: "p3" },
                { from: "q", to: "p4" },
                { from: "q", to: "p5" },
                { from: "q", to: "p6" },
                { from: "p1", to: "six" },
                { from: "p2", to: "six" },
                { from: "p3", to: "six" },
                { from: "p4", to: "six" },
                { from: "p5", to: "six" },
                { from: "p6", to: "six" },
                { from: "six", to: "vote" },
                { from: "vote", to: "log" },
              ]}
            />
          </WikiSection>
  );
}

export function VectorSpace() {
  return (
          <WikiSection id="vector-space" title="The vector space model & TF-IDF">
          <WikiThumb id="repository-stats-for-nerds" width={300} caption="Stats for Nerds lists the query vector, the candidate set and the TF-IDF score of each paper for your own search." />
            <p className="text-sm leading-6 text-ink">
              The lexical component is the classic vector space model: every
              paper becomes a vector over the corpus vocabulary, and
              relatedness is cosine similarity. The weight of a term inside
              a vector is its TF-IDF value. High when the term is frequent
              in that paper, low when it is common across the corpus.
            </p>
            <MathBlock
              lines={[
                "V        = vocabulary fitted on { text(d) : d in D }",
                "df(t)    = number of papers in D containing term t",
                "idf(t)   = ln( (1 + n) / (1 + df(t)) ) + 1      smoothed IDF",
                "w(t,d)   = tf(t,d) * idf(t)                     term weight",
                "v(d)     = w(d) / ||w(d)||_2                    L2-normalized vector",
                "",
                "s_tfidf(d) = cos( v(Q), v(d) )",
                "           = ( v(Q) · v(d) ) / ( ||v(Q)||_2 · ||v(d)||_2 )",
              ]}
            />
            <p className="text-sm leading-6 text-ink">
              The IDF formula is scikit-learn's smoothed variant: the "+1"
              inside the logarithm keeps terms that appear in every paper
              from dividing by zero, and the outer "+1" keeps even the
              most common term from receiving a zero weight. Every vector
              is L2-normalized, so cosine similarity reduces to a dot
              product between unit vectors. The vocabulary is fitted once
              at index build and never refit at request time. The query
              must live in the same vector space as the stored papers.
            </p>
            <p className="text-sm leading-6 text-ink">
              Strength and weakness: exact term matching is precise but
              blind to paraphrase; a paper on "neural networks" can miss a
              search for "deep learning". That gap is what the semantic
              component exists to close.
            </p>
          </WikiSection>
  );
}

export function Embeddings() {
  return (
          <WikiSection id="embeddings" title="Sentence embeddings & S-BERT">
          <WikiThumb id="repository-recommend-ghost-wire" width={300} caption="The same query ranked by S-BERT alone (GHOST WIRE): papers about the same idea rise even when few words are shared." />
            <p className="text-sm leading-6 text-ink">
              The semantic component replaces discrete terms with dense
              vectors learned by a transformer. Sentence-BERT (Reimers &
              Gurevych, 2019) adapts BERT into a siamese architecture: two
              identical encoders share weights, each sentence or paragraph
              is pooled into one fixed-size vector, and the network is
              trained so that related texts land close together in the
              embedding space.
            </p>
            <MathBlock
              lines={[
                "e(d)      = SBERT( text(d) )  in R^384",
                "e(Q)      = SBERT( text(Q) )",
                "",
                "s_sbert(d) = cos( e(Q), e(d) )",
                "           = ( e(Q) · e(d) ) / ( ||e(Q)||_2 · ||e(d)||_2 )",
              ]}
            />
            <WikiTable
              headers={["Property", "Value"]}
              rows={[
                ["Model", "all-MiniLM-L6-v2 (sentence-transformers)"],
                ["Transformer layers", "6"],
                ["Embedding dimension", "384"],
                ["Parameters", "≈ 22.7 million"],
                ["Max input", "256 WordPiece tokens (truncated)"],
                ["Pooling", "Mean pooling over token embeddings"],
                ["Usage", "One forward pass per query; stored paper embeddings are reused"],
              ]}
            />
            <p className="text-sm leading-6 text-ink">
              Because the embeddings capture meaning rather than surface
              terms, "deep learning" and "neural networks" can sit close
              even when they share no vocabulary. The cost is scale and
              opacity: 384 dense floats per paper, and no obvious way to
              say which terms drove a match.
            </p>
          </WikiSection>
  );
}

export function Metadata() {
  return (
          <WikiSection id="metadata" title="The metadata component">
          <WikiThumb id="upload-identifier-review" width={300} caption="The four signals this component scores (title, abstract, keywords, year) are the four the upload form validates." />
            <p className="text-sm leading-6 text-ink">
              The metadata component is a small, transparent scoring layer
              over four bibliographic fields at fixed equal weights of 25
              percent. Each text field is compared with TF-IDF cosine
              similarity, using one vectorizer per field that is fitted on
              the query together with every candidate's value of that
              field; the publication year is compared by temporal
              proximity.
            </p>
            <MathBlock
              lines={[
                "For each text field f in { title, abstract, keywords }:",
                "  V_f    = TF-IDF vectorizer fitted once per request on",
                "           { f(Q) } + { f(d') : d' in D, f(d') not blank }",
                "  s_f(d) = cos( v_f(Q), v_f(d) )",
                "         = 0  if f(Q) or f(d) is missing",
                "",
                "f(Q) = the seed's own field          (seed-paper query)",
                "     = the query string, all 3 fields (free-text query)",
                "",
                "s_year(d) = 1 / ( 1 + | year(Q) - year(d) | )",
                "          = 0  if either year is missing (always, for free text)",
                "",
                "s_meta(d) = 0.25 * s_title(d) + 0.25 * s_abstract(d)",
                "          + 0.25 * s_keywords(d) + 0.25 * s_year(d)",
              ]}
            />
            <p className="text-sm leading-6 text-ink">
              Two design decisions deserve attention. First, missing fields
              contribute 0 while the fixed weights stay. A paper with only
              one available field cannot inflate its score by omission.
              Second, the year signal decays smoothly: identical years
              score 1, one year apart scores 0.5, three years apart 0.25.
              A free-text query has no publication year, so the same query
              string is compared against each candidate's title, abstract,
              and keywords but the year term is always 0: the metadata
              score of a text query cannot exceed 0.75, while a seed-paper
              query uses the seed's own four fields and can reach 1. That
              is why metadata-inclusive pipelines behave differently under
              query search than under seed-paper search. Because the
              vectorizer is fitted on the query plus all candidates, the
              inverse document frequencies follow the corpus of that field,
              not just the pair being compared.
            </p>
            <WikiCite ids={["stats-for-nerds-checked"]} />
          </WikiSection>
  );
}

export function Fusion() {
  return (
          <WikiSection id="fusion" title="Normalization & weighted fusion">
          <WikiThumb id="repository-algorithm-dials" width={250} caption="The custom dials normalize to 100% and print the fusion formula S(d) that this section derives." />
            <p className="text-sm leading-6 text-ink">
              Three components produce scores on different scales: raw
              cosines in different vector spaces, plus an already-bounded
              metadata score. Before combination, TF-IDF and S-BERT raw
              scores are min-max normalized across the candidate set;
              metadata passes through unchanged.
            </p>
            <MathBlock
              lines={[
                "s'(d) = ( s(d) - min_s ) / ( max_s - min_s )",
                "      = 1.0 for every d   if max_s = min_s   (degenerate)",
                "",
                "S(d) = w_tfidf * s'_tfidf(d)",
                "     + w_sbert * s'_sbert(d)",
                "     + w_meta  * s_meta(d)",
              ]}
            />
            <p className="text-sm leading-6 text-ink">
              The degenerate case matters: if every candidate scores
              identically (e.g. an empty vocabulary match), the raw
              normalization would divide by zero, so the implementation
              maps the whole set to 1.0 and lets the tie-breaks decide.
              The six configurations fix the weights: linear combinations
              of the same three signals:
            </p>
            <WikiTable
              headers={["Pipeline", "Weights (tfidf, sbert, meta)", "Final score S(d)"]}
              rows={PIPELINE_ROWS}
            />
            <p className="text-sm leading-6 text-ink">
              Components with zero weight are not computed at all, so a
              pure pipeline never pays for the components it does not use.
              The custom dial pipeline is the same formula with
              user-chosen weights normalized to sum to 1.
            </p>
          </WikiSection>
  );
}

export function Ranking() {
  return (
          <WikiSection id="ranking" title="Ranking & output">
          <WikiThumb id="repository-algorithm-open" width={340} caption="Top K, Diversify (the MMR re-ranking below) and the six presets live on the algorithm bar." />
            <MathBlock
              lines={[
                "Sort candidates by S(d) descending.",
                "Tie-break: newer publication year first,",
                "          then title alphabetically.",
                "Return the top_k papers with S(d) > 0.",
              ]}
            />
            <p className="text-sm leading-6 text-ink">
              The tie-breaks form a total order: score, then year, then
              title, so the ranking is deterministic: the same query,
              pipeline, and corpus always produce the identical list. The
              score &gt; 0 filter drops papers that matched nothing.
            </p>
            <WikiSub id="mmr" title="Optional diversification (MMR)">
              <p className="text-sm leading-6 text-ink">
                A pure relevance ranking can fill up with near-duplicates of
                one paper. The <Chip>Diversify (MMR)</Chip> checkbox on the
                Search page turns on Maximal Marginal Relevance (Carbonell
                &amp; Goldstein, 1998): the positive-score results are
                reranked greedily so each pick balances its own relevance
                against its similarity to the papers already picked.
              </p>
              <MathBlock
                lines={[
                  "MMR(i) = λ · S(i) − (1 − λ) · max_{j ∈ picked} sim(i, j)",
                  "",
                  "λ = 0.7 when Diversify is ticked; off by default",
                  "pool = the top 50 positive-score results (API: 1..100)",
                  "sim = cosine of the stored S-BERT vectors, clipped to [0, 1]",
                  "      (TF-IDF vectors if fewer than two S-BERT vectors exist;",
                  "       the constant 1 if neither: no diversity signal)",
                  "First pick is always the top-scoring paper; at λ = 1 the",
                  "order is plain relevance. Ties: higher S(d), then lower id.",
                ]}
              />
              <p className="text-sm leading-6 text-ink">
                MMR only reorders: it never changes a score, never adds or
                drops a paper from the pool, and the default path (switch
                off) is byte-for-byte the ranking above. The whole pool is
                reordered and the first top_k of the new order are
                returned; papers beyond the pool keep their relevance
                order. Each pair of pool papers is compared exactly once,
                pool(pool − 1)/2 similarities, which is 1,225 at the
                default pool of 50, so the cost is small and never an n × n
                matrix.
              </p>
            </WikiSub>
            <WikiCite ids={["engine-mmr-and-citations"]} />
          </WikiSection>
  );
}

export function Graph() {
  return (
          <WikiSection id="graph" title="The similar-papers graph">
          <WikiThumb id="repository-inspector-similar" width={280} caption="The graph in the inspector: nodes are the top results, edges use the active pipeline." />
          <WikiThumb id="library-graph-selected" float="left" width={340} caption="In My Library the zones are clusters; the leader lines name them." />
            <p className="text-sm leading-6 text-ink">
              The similar-papers graph turns the ranked list into a small
              weighted graph: the selected paper is the origin node, the
              top_k results are its neighbors, and every pair of graph
              papers is joined by a blended edge weight that reuses the
              active pipeline's own components, so the graph can never
              disagree with the pipeline that selected its nodes.
            </p>
            <MathBlock
              lines={[
                "w(a,b) = w_tfidf * cos( v_tfidf(a), v_tfidf(b) )",
                "       + w_sbert * cos( e_sbert(a), e_sbert(b) )",
                "       + w_meta  * meta(a, b)",
                "       + 0.15    * J( authors(a), authors(b) )",
                "       + 0.25    * C( a, b )",
                "",
                "J = Jaccard over lowercased author last names",
                "C = 0.5 * coupling(a,b) + 0.5 * cocitation(a,b)",
                "    coupling   = |shared references| / min(|refs(a)|,   |refs(b)|)",
                "    cocitation = |shared citing works| / min(|citers(a)|, |citers(b)|)",
                "    C = 0 for a pair with no cached citation rows",
                "w(a,b) clamped to [0, 1]; missing vector contributes 0",
                "",
                "Edges: origin star always drawn; other pairs",
                "       drawn only if w(a,b) >= 0.15",
                "",
                "Shortest paths: Dijkstra from the origin with",
                "hop cost = 1 - w(a,b); ties break by paper id",
              ]}
            />
            <p className="text-sm leading-6 text-ink">
              The 0.15 author-overlap bonus is the local analogue of the
              reference model's shared-author contribution: two papers by
              the same author are a little closer than their texts alone
              suggest. The graph uses raw component similarities, not the
              min-max normalized scores of the ranked list. The 0.25
              citation term is bibliographic coupling (papers citing the
              same works) plus co-citation (papers cited together),
              computed from reference and citer lists cached from
              OpenAlex; a paper's rows are filled by refreshing its
              citations, and a pair with no cached rows contributes
              exactly 0, so an un-refreshed database scores as it did
              before. Where no citation data exists, shared authors and
              topics still stand in for bibliographic coupling, a
              deliberate substitution, not a claim of equivalence.
            </p>

            <WikiSub id="dijkstra" title="Shortest paths: Dijkstra's algorithm">
              <p className="text-sm leading-6 text-ink">
                The edge weights say how related two papers are; the
                shortest-path step says how a paper is related to the
                origin. Select a node and the page highlights the route
                from the origin to it: the chain of papers whose successive
                similarities are strongest overall. The server computes
                that route once, with Dijkstra's algorithm, so the
                highlighted path is a real similarity route and not merely
                the fewest hops. Only the local graph uses it.
              </p>
              <MathBlock
                lines={[
                  "G = (V, E, w), undirected",
                  "V = { o } + the top_k results            |V| = k + 1",
                  "E = { (o, v) : v != o }                  the origin star",
                  "  + { (a, b) : w(a,b) >= 0.15 }          the strong pairs",
                  "",
                  "c(a,b) = max( 0, 1 - w(a,b) )            edge cost, in [0, 1]",
                  "len(P) = sum of c(e) over the edges e of a path P",
                  "d(v)   = min over paths P from o to v of len(P),   d(o) = 0",
                ]}
              />
              <p className="text-sm leading-6 text-ink">
                The cost 1 − w turns similarity into distance: a perfect
                edge (w = 1) is free and an unrelated pair (w = 0) costs a
                full 1. Because the origin is joined to every node, a route
                always exists, and for every node v the distance is at most
                the direct cost: d(v) ≤ 1 − w(o, v) ≤ 1.
              </p>
              <p className="text-sm leading-6 text-ink">
                The implementation, step for step:
              </p>
              <MathBlock
                lines={[
                  "d(o) = 0;  d(v) = infinity for every other v",
                  "Q = a min-heap holding (0, o), ordered by (distance, paper id)",
                  "",
                  "while Q is not empty:",
                  "    (delta, u) = pop the smallest entry of Q",
                  "    if u is already settled: skip this stale entry",
                  "    settle u                       d(u) = delta is now final",
                  "    for each neighbor v of u, with cost c(u, v):",
                  "        if delta + c(u,v) < d(v) - 1e-9:",
                  "            d(v) = delta + c(u,v);  pred(v) = u",
                  "            push (d(v), v) onto Q",
                  "",
                  "path(v) = follow pred from v back to o, then reverse",
                  "output d(v) rounded to 4 decimals, and path(v), for every",
                  "node reached",
                ]}
              />
              <p className="text-sm leading-6 text-ink">
                <strong>Why it is correct.</strong> Dijkstra needs every
                cost to be non-negative, and the clamp in c(a,b) guarantees
                it. The invariant: when u is popped, no unsettled node can
                give a shorter route to u, because any such route would
                have to leave the settled set through a node whose tentative
                distance is already at least delta and then add a cost of 0
                or more. So d(u) is final the moment u is settled, and every
                node is settled exactly once. Stale heap entries (a node
                pushed again after an improvement) are simply skipped when
                they surface, which is cheaper than updating the heap in
                place.
              </p>
              <p className="text-sm leading-6 text-ink">
                <strong>When does an indirect route win?</strong> For an
                origin o, an intermediate paper m and a target v:
              </p>
              <MathBlock
                lines={[
                  "o -> m -> v beats the direct edge o -> v",
                  "    <=>  c(o,m) + c(m,v) < c(o,v)",
                  "    <=>  (1 - w1) + (1 - w2) < 1 - wd",
                  "    <=>  w1 + w2 > 1 + wd",
                  "",
                  "w1 = w(o,m),  w2 = w(m,v),  wd = w(o,v)",
                ]}
              />
              <p className="text-sm leading-6 text-ink">
                Each weight is at most 1, so both hops must be strong: for
                example 0.60 + 0.60 beats a direct edge of 0.19 but not one
                of 0.21. A weakly related paper is pulled onto the route of
                a strongly related neighbor that bridges it to the origin,
                which is exactly the similarity route the graph highlights.
                Longer chains compete the same way: extra hops cost at
                least nothing, but the whole sum must stay below the direct
                cost.
              </p>
              <p className="text-sm leading-6 text-ink">
                <strong>Determinism.</strong> Ties are settled by rules. The
                heap orders entries by (distance, paper id), so among equal
                distances the smaller id is settled first; a later route
                replaces a stored predecessor only if it is better by more
                than 1e-9, so floating-point noise cannot flip a path; and
                the result does not depend on the order of the edge list
                (the test suite shuffles it). The same graph always yields
                the same distances and paths.
              </p>
              <p className="text-sm leading-6 text-ink">
                <strong>Cost.</strong> Each undirected edge is relaxed from
                both ends, so there are at most 2E heap pushes, each pop or
                push costing O(log V): the total is O((V + E) log V). With
                at most 41 nodes in the interface and E ≤ V(V − 1)/2 ≤ 820
                edges, that is a few thousand operations, negligible next
                to computing the E edge weights.
              </p>
              <p className="text-sm leading-6 text-ink">
                These statements are pinned by test/test_shortest_paths.py:
                the worked example below, the w1 + w2 &gt; 1 + wd condition
                over a grid of weights, the tie-break rules, and agreement
                with an independent Bellman-Ford implementation on 300
                random graphs, where every returned path costs exactly its
                distance.
              </p>
              <WikiCite ids={["engine-dijkstra"]} />
            </WikiSub>
          </WikiSection>
  );
}

export function ArenaVoting() {
  return (
          <WikiSection id="arena" title="The Arena as a voting system">
          <WikiThumb id="arena-winner" width={320} caption="The winner banner: the independence-weighted share the section below defines." />
            <p className="text-sm leading-6 text-ink">
              The Arena treats the six pipelines as voters. Every voter
              submits a ranked list of top_k papers; the Arena then asks
              three questions: which papers do most voters agree on, how
              much do pairs of voters agree, and which voter is the best
              summarizer of the others.
            </p>
            <p className="text-sm leading-6 text-ink">
              The voting system runs on two scopes with identical
              mathematics: the stored repository, and live web hits from
              OpenAlex, Crossref, and arXiv. Web candidates are vectorized
              on the fly with the same stored TF-IDF vectorizer and S-BERT
              model, so the same normalization, fusion, and
              independence-weighted winner apply without retraining
              anything.
            </p>
            <WikiCite ids={["web-battles"]} />
            <WikiSub id="consensus" title="Consensus ranking (a Borda-style count)">
              <p className="text-sm leading-6 text-ink">
                Every paper any pipeline ranked collects votes (how many
                pipelines included it); papers are ordered by votes, then
                by average rank, then by paper id, the same total-order
                discipline as the ranking rule.
              </p>
            </WikiSub>
            <WikiSub id="pairwise" title="Pairwise agreement">
              <p className="text-sm leading-6 text-ink">
                Each pair of pipelines is compared on the papers both
                ranked: overlap@k (shared selection) and the mean absolute
                rank gap (positional divergence; lower means closer).
              </p>
            </WikiSub>
            <WikiSub id="winner" title="The independence-weighted winner">
              <p className="text-sm leading-6 text-ink">
                A naive vote count would let a hybrid win by agreeing with
                its own components. The hybrid is literally built from
                them. The Arena instead weights each vote by the
                independence of the two voters: the Jaccard distance
                between their component sets.
              </p>
              <MathBlock
                lines={[
                  "independence(P, Q) = 1 - Jaccard( C_P, C_Q )",
                  "",
                  "  C_P = the set of components pipeline P uses",
                  "  disjoint pipelines  -> 1.00",
                  "  a two-signal hybrid vs one of its own components -> 0.50",
                  "  the full hybrid vs a single-signal pipeline -> 0.67",
                ]}
              />
              <WikiTable
                headers={["Pair (P vs Q)", "Shared components", "independence(P, Q)"]}
                rows={INDEPENDENCE_ROWS}
              />
              <MathBlock
                lines={[
                  "captured(P) = ( 1 / |top_k| ) * sum over d in top_k(P) of",
                  "              sum over Q != P with d in top_k(Q) of",
                  "              independence(P, Q)",
                  "",
                  "available(P) = sum over Q != P of independence(P, Q)",
                  "share(P)     = captured(P) / available(P)",
                  "",
                  "Winner: pipeline with the largest share(P);",
                  "ties fall to the lower average consensus rank.",
                ]}
              />
              <p className="text-sm leading-6 text-ink">
                The share normalizes hybrids and pure pipelines onto one
                scale. The winner is a measure of agreement breadth under
                independence weighting, not of correctness: pipelines can
                agree in error together, and the Arena never claims more
                than that.
              </p>
            </WikiSub>
            <WikiGallery cols={3} ids={["arena-consensus", "arena-pairwise", "arena-battle-grid"]} />
          </WikiSection>
  );
}

export function Complexity() {
  return (
          <WikiSection id="complexity" title="Algorithms & complexity">
            <p className="text-sm leading-6 text-ink">
              With 150 valid papers the whole pipeline is comfortably
              interactive, but the orders of growth are worth recording
              (n = valid papers, d = vector dimension, k = top_k, V and E
              = graph nodes and edges):
            </p>
            <WikiTable
              headers={["Operation", "What runs", "Order of work"]}
              rows={COMPLEXITY_ROWS}
            />
            <p className="text-sm leading-6 text-ink">
              The arena's six searches dominate a battle; the graph's
              O(V²) pair scan over k + 1 nodes is tiny at k ≤ 40. Nothing
              in the request path touches the full corpus twice.
            </p>
          </WikiSection>
  );
}

export function Engineering() {
  return (
          <WikiSection id="engineering" title="Computer science behind the scenes">
            <WikiTable
              headers={["Concern", "How the system handles it"]}
              rows={ENGINEERING_ROWS.map(([concern, handling]) => [concern, handling])}
            />
          </WikiSection>
  );
}

export function WorkedExample() {
  return (
          <WikiSection id="worked-example" title="Worked example">
          <WikiThumb id="lab-stats-for-nerds" width={280} caption="The real trace of a recipe on a real query, to compare with the synthetic numbers below." />
            <p className="text-sm leading-6 text-ink">{WORKED_NOTE}</p>
            <WikiSub id="example-inputs" title="The inputs">
              <WikiTable
                headers={["Paper", "Title", "Year"]}
                rows={[
                  ["A", "neural networks for text classification", "2023"],
                  ["B", "statistical models in machine translation", "2015"],
                  ["C", "deep learning for natural language processing", "2021"],
                ]}
              />
              <p className="text-sm leading-6 text-ink">
                Query Q = "deep learning text classification". Suppose the
                three components return these raw scores:
              </p>
              <WikiTable
                headers={["Paper", "s_tfidf (raw)", "s_sbert (raw)", "s_meta"]}
                rows={[
                  ["A", "0.72", "0.81", "0.60"],
                  ["B", "0.18", "0.34", "0.15"],
                  ["C", "0.66", "0.88", "0.55"],
                ]}
              />
            </WikiSub>
            <WikiSub id="example-fusion" title="Fusion step by step">
              <p className="text-sm leading-6 text-ink">
                Min-max normalization: TF-IDF min = 0.18, max = 0.72 →
                A = 1.00, B = 0.00, C = (0.66 − 0.18) / 0.54 ≈ 0.89.
                S-BERT min = 0.34, max = 0.88 → A ≈ 0.87, B = 0.00, C =
                1.00. Metadata passes through unchanged.
              </p>
              <WikiTable
                headers={["Paper", "s'_tfidf", "s'_sbert", "s_meta", "S(d) = 0.4 + 0.4 + 0.2"]}
                rows={[
                  ["A", "1.00", "0.87", "0.60", "0.400 + 0.348 + 0.120 = 0.868"],
                  ["B", "0.00", "0.00", "0.15", "0.000 + 0.000 + 0.030 = 0.030"],
                  ["C", "0.89", "1.00", "0.55", "0.356 + 0.400 + 0.110 = 0.866"],
                ]}
              />
              <p className="text-sm leading-6 text-ink">
                Ranking: A (0.868), C (0.866), B (0.030). The full hybrid
                separates A from C by two thousandths. That is the exact lesson
                of fusion: when components disagree, the weights decide,
                and the ranking can flip on a small change.
              </p>
            </WikiSub>
            <WikiSub id="example-graph" title="The graph over the same papers">
              <p className="text-sm leading-6 text-ink">
                Graph edges reuse the raw component scores (no
                normalization) plus the author bonus. Suppose A and B share
                one of three authors (J = 1/3) and the metadata pairs
                score 0.62, 0.10, and 0.08:
              </p>
              <WikiTable
                headers={["Edge", "w(a,b) = 0.4·tf + 0.4·sb + 0.2·meta + 0.15·J", "Weight"]}
                rows={[
                  ["A–C", "0.288 + 0.352 + 0.124 + 0.000", "0.764"],
                  ["A–B", "0.072 + 0.136 + 0.020 + 0.050", "0.278"],
                  ["B–C", "0.040 + 0.120 + 0.016 + 0.000", "0.176"],
                ]}
              />
              <WikiTable
                headers={["Origin → node", "Shortest path", "Length (hop costs 1 − w)"]}
                rows={[
                  ["A → C", "[A, C]", "1 − 0.764 = 0.236"],
                  ["A → B", "[A, B]", "1 − 0.278 = 0.722"],
                ]}
              />
              <p className="text-sm leading-6 text-ink">
                All three edges clear the 0.15 threshold. Shortest paths
                are always measured from the origin A, and here both direct
                routes survive: A → B costs 0.722 directly against 0.236 +
                0.824 = 1.060 through C, and A → C costs 0.236 directly
                against 0.722 + 0.824 = 1.546 through B. A → C is the
                tightest connection: two papers on neural text methods,
                0.236 apart.
              </p>
            </WikiSub>
            <WikiSub id="example-dijkstra" title="Dijkstra step by step (a fourth paper)">
              <p className="text-sm leading-6 text-ink">
                An indirect route needs a bridge. Add a paper D on the same
                topic as C, with w(C,D) = 0.820 and w(A,D) = 0.310; the pair
                B–D is below the 0.15 threshold and is not drawn. Costs are
                c = 1 − w:
              </p>
              <WikiTable
                headers={["Edge", "Weight w", "Cost c = 1 − w"]}
                rows={[
                  ["A–B", "0.278", "0.722"],
                  ["A–C", "0.764", "0.236"],
                  ["A–D", "0.310", "0.690"],
                  ["B–C", "0.176", "0.824"],
                  ["C–D", "0.820", "0.180"],
                ]}
              />
              <WikiTable
                headers={["Step", "Pop and settle", "Relaxations", "Distances afterwards"]}
                rows={[
                  ["1", "A (0)", "B ← 0.722, C ← 0.236, D ← 0.690", "A 0 · B 0.722 · C 0.236 · D 0.690"],
                  ["2", "C (0.236)", "B: 0.236 + 0.824 = 1.060 is not better. D: 0.236 + 0.180 = 0.416 beats 0.690, so D ← 0.416 via C", "B 0.722 · C 0.236 · D 0.416"],
                  ["3", "D (0.416)", "its neighbors A and C are already settled", "unchanged"],
                  ["4", "(0.690, D)", "stale entry for D, skipped", "unchanged"],
                  ["5", "B (0.722)", "its neighbors A and C are already settled", "final"],
                ]}
              />
              <WikiTable
                headers={["Origin → node", "Shortest path", "Length"]}
                rows={[
                  ["A → C", "[A, C]", "0.236"],
                  ["A → D", "[A, C, D]", "0.236 + 0.180 = 0.416 (the direct edge costs 0.690)"],
                  ["A → B", "[A, B]", "0.722"],
                ]}
              />
              <p className="text-sm leading-6 text-ink">
                The condition from above predicts it: w(A,C) + w(C,D) =
                0.764 + 0.820 = 1.584, which is more than 1 + w(A,D) =
                1.310, so the route through C wins, by 0.690 − 0.416 =
                0.274. B stays direct because through C it would cost
                1.060. This exact graph is a unit test, so the table above
                is what the engine returns.
              </p>
            </WikiSub>
          </WikiSection>
  );
}

export function Trivia() {
  return (
          <WikiSection id="trivia" title="Tips & trivia">
            <ul className="list-inside list-disc space-y-1.5 text-sm leading-6 text-ink">
              <li>
                Smoothed IDF never lets a term reach weight zero, and the
                ln((1+n)/(1+df)) form is scikit-learn's exact default: 
                the same numbers the stored vectors were built with.
              </li>
              <li>
                The degenerate min-max rule maps a tied score set to 1.0
                instead of crashing: an all-zero vocabulary match still
                produces a well-defined ranking via the tie-breaks.
              </li>
              <li>
                Year proximity is a bounded decay: 1/(1+|Δy|) equals 1 at
                Δy = 0, 0.5 at Δy = 1, 0.25 at Δy = 3, never 0 for any
                finite gap.
              </li>
              <li>
                The independence weight is a Jaccard distance, so it lies
                in [0, 1]; the full hybrid can never weigh more than 2/3
                against a single-signal pipeline, no matter how similar
                their lists look.
              </li>
              <li>
                The Arena winner is a Borda-flavored consensus summary, not
                a relevance judgment. Two pipelines agreeing can both be
                wrong together.
              </li>
              <li>
                Every tie-break in the system is total (score → year →
                title; votes → avg rank → paper id), which is why battle
                runs and rankings are reproducible to the last paper.
              </li>
              <li>
                The search path is O(n·d) with n = 156 valid papers. The
                whole corpus is scored per query, and nothing is indexed
                beyond the stored vectors and embeddings.
              </li>
            </ul>
          </WikiSection>
  );
}

