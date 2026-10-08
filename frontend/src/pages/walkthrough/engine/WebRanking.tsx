import { Chip, MathBlock, WikiSection, WikiSub, WikiTable } from "../wiki";
import { P, WikiGallery, WikiHatnote, WikiNote, WikiThumb, Xref } from "../wikiMedia";

export function WebRanking() {
  return (
    <WikiSection id="web-ranking" title="Ranking the web">
      <WikiThumb id="repository-web" width={420} />
      <P>
        The Repository's <Chip>Web</Chip> scope and the Arena's web field apply the pipelines to papers that
        are not in the database. The idea is the one the whole engine rests on: a pipeline is only a weighted
        sum of three component scores, and a component score is just a similarity between the query and a
        candidate's text. Nothing in that definition needs the candidate to be stored, so the same weights can
        rank live hits.
      </P>

      <WikiSub id="web-candidates" title="Where the candidates come from">
        <P>
          One request fans out to OpenAlex, Crossref and arXiv in parallel (a shared pool, with a hard
          deadline so a slow source cannot hold the answer back), merges the hits, removes duplicates across
          sources by DOI and normalized title, drops retracted works, and, unless arXiv is selected or
          peer review is switched off, keeps only journal articles, conference papers and book chapters. Each
          hit carries its title, authors, abstract, year, venue, citation count, open-access flag and the
          source that answered. The server fetches up to 25 hits and caches identical queries for ten
          minutes; identical queries in flight share one upstream request.
        </P>
      </WikiSub>

      <WikiSub id="web-vectorize" title="Vectorizing a candidate on the fly">
        <P>
          Every hit becomes a transient record with a negative id, so it can never collide with a repository
          paper. Its prepared text is built exactly as for stored papers (title and abstract, lower-cased and
          cleaned), and then:
        </P>
        <MathBlock
          lines={[
            "q_t   = tfidf.transform( prepared(Q) )            the STORED vectorizer, never refit",
            "h_t   = tfidf.transform( prepared(hit) )",
            "s_tfidf(hit)  = cos( q_t , h_t )",
            "",
            "q_e   = SBERT( prepared(Q) )         h_e = SBERT( prepared(hit) )      both in R^384",
            "s_sbert(hit)  = cos( q_e , h_e )",
            "",
            "s_meta(hit)   = 0.25·sim(title) + 0.25·sim(abstract) + 0.25·sim(keywords) + 0.25·sim(year)",
          ]}
        />
        <P>
          The TF-IDF side reuses the vocabulary and the inverse document frequencies fitted on the repository,
          so a web hit lives in the same vector space as the corpus; words the repository has never seen are
          simply ignored. S-BERT needs no fitting at all. A web hit has no keywords field, so that term
          contributes 0, and a free-text query has no year, so the year term is 0 as well: the metadata score
          of a web hit under a free-text query therefore tops out at 0.5.
        </P>
      </WikiSub>

      <WikiSub id="web-fusion" title="One pipeline, one ranking">
        <P>
          Normalization and fusion are then identical to a repository search, with one difference worth
          knowing: the min-max normalization of TF-IDF and S-BERT runs over the <em>candidate set</em>, which
          here is the 20 to 25 web hits and not the whole corpus. That keeps the scores comparable inside the
          list (the best hit scores 1 on each active signal) but means a web score is a relative measure: do
          not compare a web score with a repository score.
        </P>
        <MathBlock
          lines={[
            "Final(hit) = w_tfidf·minmax_C(s_tfidf) + w_sbert·minmax_C(s_sbert) + w_meta·s_meta",
            "ranked by Final desc ; ties: newer year, then title ; only Final > 0 is returned ; limit top_k",
          ]}
        />
        <WikiThumb id="repository-web-ghost-wire" float="left" width={420} />
        <P>
          The endpoint returns each hit together with its rank, its final score and its three component
          scores (shown on hover in the interface). Pressing another algorithm calls it again with that
          pipeline's weights over the same query, which is why the candidates stay and the order and scores
          change: S-BERT (GHOST WIRE) rewards hits about the same idea in different words, TF-IDF (PIXEL
          PUNCH) rewards hits that share your terms.
        </P>
        <WikiTable
          headers={["Property", "Repository search", "Web recommendation"]}
          rows={[
            ["Candidate set", "Every valid paper in the corpus (n ≈ 150)", "The 20 to 25 live hits for the query"],
            ["TF-IDF vectors", "Stored, fitted on the corpus", "Computed on the fly with the stored vectorizer"],
            ["S-BERT embeddings", "Stored", "Computed on the fly (one batch)"],
            ["Normalization set", "The whole corpus", "The candidate set"],
            ["Recorded?", "Arena runs are logged to the battle history", "Never recorded; exploratory"],
          ]}
        />
        <WikiNote kind="note">
          The Arena's web field runs all six pipelines over the same hits and compares them with the usual
          consensus and independence-weighted winner; see <Xref to="/walkthrough-engine/arena-voting">The Arena
          as a voting system</Xref>.
        </WikiNote>
        <WikiHatnote>
          In the application: <Xref to="/walkthrough/recommending#reco-web">Recommending, Web</Xref> and{" "}
          <Xref to="/walkthrough/arena">Arena</Xref>.
        </WikiHatnote>
      </WikiSub>
    </WikiSection>
  );
}
