import {
  Chip,
  MathBlock,
  WikiFooter,
  WikiHeader,
  WikiInfobox,
  WikiNav,
  WikiSection,
  WikiSub,
  WikiTable,
} from "./wiki";

/* ============================================================
   ENGINE WALKTHROUGH: the mathematics and computer science
   behind Re:Search, documented the way a walkthrough documents
   a game world: every formula, its role, and a worked example.
   Temporary tab: hide it by flipping SHOW_ENGINE_TAB in
   AppLayout.tsx to false.
   ============================================================ */

const INFOBOX_ROWS: [string, string][] = [
  ["Name", "The Re:Search engine"],
  ["Core models", "Vector space (TF-IDF) · sentence embeddings (S-BERT) · metadata fusion · weighted graph"],
  ["Algorithms", "TF-IDF · cosine similarity · min-max normalization · Dijkstra's shortest paths · independence-weighted voting"],
  ["Embedding model", "all-MiniLM-L6-v2, 6 layers, 384 dimensions"],
  ["Signals", "TF-IDF (lexical) · S-BERT (semantic) · Metadata (4 fields)"],
  ["Pipelines", "6 fixed configurations + 1 custom dial"],
  ["Scale", "n = 146 valid papers · per-search work O(n·d)"],
  ["Determinism", "Deterministic (total tie-breaks, fixed seeds"],
  ["Status", "Local research prototype"],
];

const TOC = [
  ["overview", "Overview"],
  ["vector-space", "The vector space model & TF-IDF"],
  ["embeddings", "Sentence embeddings & S-BERT"],
  ["metadata", "The metadata component"],
  ["fusion", "Normalization & weighted fusion"],
  ["ranking", "Ranking & output"],
  ["graph", "The similar-papers graph"],
  ["arena", "The Arena as a voting system"],
  ["complexity", "Algorithms & complexity"],
  ["engineering", "Computer science behind the scenes"],
  ["worked-example", "Worked example"],
  ["trivia", "Tips & trivia"],
] as const;

const OTHER_PAGES = [
  ["/recommendations", "Search"],
  ["/repository", "Repository"],
  ["/upload", "Upload"],
  ["/library", "My Library"],
  ["/evaluation", "Arena"],
  ["/walkthrough", "Walkthrough"],
  ["/faq", "FAQ"],
] as const;

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
  ["Arena battle", "Six searches + comparisons", "6 × search, then O(36·k) pairwise and O(6n) consensus"],
  ["Similar-papers graph", "Edges between graph papers + Dijkstra", "O(V²) candidate pairs (V = k + 1), then O(E log V)"],
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

export default function MathWalkthrough() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
      <WikiHeader
        eyebrow="ENGINE · ENCYCLOPEDIA-STYLE"
        title="The mathematics & computer science of Re:Search"
        description="Every formula the system computes, explained: the vector space model, sentence embeddings, metadata fusion, the similar-papers graph, and the Arena's voting system, plus a worked example you can follow by hand."
        categories={["Category: Mathematics", "Category: Computer Science", "Category: Walkthrough"]}
      />

      <div className="flex flex-col gap-8 lg:flex-row">
        <WikiNav toc={TOC} otherPages={OTHER_PAGES} />

        <div className="min-w-0 flex-1 space-y-10">
          {/* ---- infobox + overview ---- */}
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

          <WikiSection id="vector-space" title="The vector space model & TF-IDF">
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

          <WikiSection id="embeddings" title="Sentence embeddings & S-BERT">
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

          <WikiSection id="metadata" title="The metadata component">
            <p className="text-sm leading-6 text-ink">
              The metadata component is a small, transparent scoring layer
              over four bibliographic fields at fixed equal weights of 25
              percent. Text fields are compared with pairwise TF-IDF
              cosine similarity; the publication year is compared by
              temporal proximity.
            </p>
            <MathBlock
              lines={[
                "For each text field f in { title, abstract, keywords }:",
                "  s_f(d) = cos( TFIDF({ f(Q) }), TFIDF({ f(d) }) )",
                "         = 0  if the field is missing in Q or d",
                "",
                "s_year(d) = 1 / ( 1 + | year(Q) - year(d) | )",
                "          = 0  if either year is missing",
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
              On free-text queries only the title signal is active (the
              other fields do not exist in the query), so metadata-inclusive
              pipelines behave differently under query search than under
              seed-paper search.
            </p>
          </WikiSection>

          <WikiSection id="fusion" title="Normalization & weighted fusion">
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

          <WikiSection id="ranking" title="Ranking & output">
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
          </WikiSection>

          <WikiSection id="graph" title="The similar-papers graph">
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
                "",
                "J = Jaccard over lowercased author last names",
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
              min-max normalized scores of the ranked list. Because the
              repository stores no reference lists, shared authors and
              shared topics stand in for bibliographic coupling, a
              deliberate substitution, not a claim of equivalence.
            </p>
          </WikiSection>

          <WikiSection id="arena" title="The Arena as a voting system">
            <p className="text-sm leading-6 text-ink">
              The Arena treats the six pipelines as voters. Every voter
              submits a ranked list of top_k papers; the Arena then asks
              three questions: which papers do most voters agree on, how
              much do pairs of voters agree, and which voter is the best
              summarizer of the others.
            </p>
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
          </WikiSection>

          <WikiSection id="complexity" title="Algorithms & complexity">
            <p className="text-sm leading-6 text-ink">
              With 146 valid papers the whole pipeline is comfortably
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

          <WikiSection id="engineering" title="Computer science behind the scenes">
            <WikiTable
              headers={["Concern", "How the system handles it"]}
              rows={ENGINEERING_ROWS.map(([concern, handling]) => [concern, handling])}
            />
          </WikiSection>

          <WikiSection id="worked-example" title="Worked example">
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
                  ["B → C", "[B, C] (direct)", "1 − 0.176 = 0.824"],
                ]}
              />
              <p className="text-sm leading-6 text-ink">
                All three edges clear the 0.15 threshold, and every direct
                edge beats the two-hop route through the origin. Dijkstra
                keeps the direct paths. A→C is the tightest connection:
                two papers on neural text methods, 0.236 apart.
              </p>
            </WikiSub>
          </WikiSection>

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
                The search path is O(n·d) with n = 146 valid papers. The
                whole corpus is scored per query, and nothing is indexed
                beyond the stored vectors and embeddings.
              </li>
            </ul>
          </WikiSection>

          <WikiFooter ctaTo="/evaluation" ctaLabel="OPEN THE ARENA" />
        </div>
      </div>
    </div>
  );
}